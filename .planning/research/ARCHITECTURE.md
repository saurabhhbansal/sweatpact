# Architecture Research

**Domain:** PostHog analytics + protected `/admin` dashboard integration into an existing Next.js 14 App Router server-driven monolith (SweatPact)
**Researched:** 2026-06-20
**Confidence:** HIGH (PostHog client/server patterns, App Router constraints, Supabase auth integration all verified against official docs and the existing codebase; one MEDIUM area flagged: PostHog HogQL query freshness/caching at scale)

## Standard Architecture

This milestone adds **two loosely-coupled subsystems** that both ride on the existing layered monolith without disturbing the financial/check-in core:

1. **Analytics ingestion** — client + server events flowing *out* to PostHog Cloud.
2. **Admin dashboard** — a new owner-only route group that pulls data *in* from two sources: Supabase (financial/business truth) and the PostHog Query API (product analytics).

These are deliberately separate. PostHog is a fire-and-forget telemetry sink (never the source of truth for money). Supabase remains authoritative for anything financial. The dashboard *composes* both but never lets PostHog numbers influence enforcement.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (browser / PWA)                         │
├──────────────────────────────────────────────────────────────────────┤
│  instrumentation-client.ts  ──init──▶  posthog-js (singleton)          │
│        │                                      ▲                         │
│        │                                      │ posthog.capture()       │
│  ┌─────┴───────┐   ┌──────────────┐   ┌───────┴────────┐                │
│  │ PageviewTrkr│   │ (tabs) client│   │ Coachmark /    │                │
│  │ (usePathname│   │ components   │   │ check-in UI    │                │
│  │  client cmp)│   │              │   │                │                │
│  └─────────────┘   └──────────────┘   └────────────────┘                │
└───────────────────────────┬───────────────────────────────────────────┘
                            │  /ingest/* (rewrite → us.i.posthog.com)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS SERVER (Vercel, Node runtime)         │
├──────────────────────────────────────────────────────────────────────┤
│  Server-side capture          │   Admin dashboard (RSC)                 │
│  ┌────────────────────┐       │   ┌──────────────────────────────┐     │
│  │ src/lib/analytics/ │       │   │ /admin/layout.tsx (owner gate)│    │
│  │   server.ts        │       │   │      ↓                        │     │
│  │ (posthog-node,     │       │   │ /admin/page.tsx (RSC)         │     │
│  │  flushAt:1)        │       │   │   ├─ getAdminMetrics()  ──────┼──▶ Supabase admin
│  │  ▲ check-in,       │       │   │   └─ posthogQuery()     ──────┼──▶ PostHog Query API
│  │    settlement,     │       │   │          ↓                    │     │   (HogQL, server-only key)
│  │    enforcement     │       │   │   <ChartCard/> (client cmps)  │     │
│  └────────────────────┘       │   └──────────────────────────────┘     │
├───────────────────────────────┴────────────────────────────────────────┤
│  Existing: api/**/route.ts (Zod), middleware.ts, cron/enforce          │
└──────────────────────────┬───────────────────────────┬────────────────┘
                           ▼                           ▼
              ┌────────────────────────┐   ┌──────────────────────────┐
              │   Supabase Postgres    │   │      PostHog Cloud        │
              │   (RLS, source of      │   │  (events, funnels,        │
              │    truth — money)      │   │   product analytics)      │
              └────────────────────────┘   └──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `instrumentation-client.ts` | One-time `posthog.init()` for the whole session | Root file (Next ≥14.2) — no provider needed for init |
| `PostHogPageview` (client) | Manual `$pageview` on App Router route change | `"use client"` component reading `usePathname()` + `useSearchParams()` |
| `src/lib/analytics/client.ts` | Thin, typed wrappers over `posthog.capture()` | Named event functions, e.g. `trackCheckin()` — keeps event names centralized |
| `src/lib/analytics/server.ts` | Server-side capture (`posthog-node`) for trusted/financial events | `flushAt:1, flushInterval:0` per request; `await shutdown()` |
| `src/lib/analytics/query.ts` | Read product analytics back out via HogQL Query API | `fetch` POST with server-only personal API key, wrapped in cache |
| `/admin/layout.tsx` | Owner-only auth gate (Supabase) | RSC; `getAuthUser()` + owner-id check → `notFound()` |
| `/admin/page.tsx` (+ sub-pages) | Compose Supabase + PostHog data, render charts | RSC fetches both sources in parallel, passes plain data to client chart components |
| `src/lib/admin/metrics.ts` | Pure/Supabase-backed business metrics (pacts, stakes, settlements) | Mirrors existing `src/lib/` domain-module convention; Vitest-tested |
| Chart components | Visualize metrics | shadcn chart (Recharts) client components |

## Recommended Project Structure

```
src/
├── instrumentation-client.ts          # NEW — posthog.init(); runs once client-side
├── middleware.ts                       # MODIFIED — add /ingest matcher exclusion
├── next.config.mjs                     # MODIFIED — /ingest reverse-proxy rewrites
├── app/
│   ├── layout.tsx                      # MODIFIED — mount <PostHogPageview/> (client)
│   ├── (tabs)/…                         # MODIFIED — sprinkle event calls in client cmps
│   └── admin/                          # NEW — route group, NOT under (tabs)
│       ├── layout.tsx                  #   owner-only gate + admin shell (own chrome)
│       ├── page.tsx                    #   overview (RSC composes both sources)
│       ├── funnel/page.tsx             #   onboarding funnel (PostHog)
│       ├── checkins/page.tsx           #   check-in rate over time
│       ├── financial/page.tsx          #   pacts/stakes/settlements (Supabase)
│       └── _components/                #   admin-only client chart components
│           ├── chart-card.tsx
│           ├── funnel-chart.tsx
│           └── trend-chart.tsx
├── components/
│   ├── analytics/
│   │   └── posthog-pageview.tsx        # NEW — usePathname pageview tracker (client)
│   └── ui/chart.tsx                    # NEW — shadcn chart primitive (Recharts)
└── lib/
    ├── analytics/
    │   ├── client.ts                   # NEW — typed posthog.capture() wrappers
    │   ├── server.ts                   # NEW — posthog-node factory + capture helper
    │   ├── query.ts                    # NEW — HogQL Query API client (server-only)
    │   └── events.ts                   # NEW — event-name constants + payload types
    ├── admin/
    │   ├── auth.ts                     # NEW — requireOwner() guard (server-only)
    │   ├── metrics.ts                  # NEW — Supabase business-metric aggregations
    │   └── metrics.test.ts             # NEW — Vitest, per existing convention
    └── supabase/                       # UNCHANGED — reuse admin/rsc factories as-is
```

### Structure Rationale

- **`admin/` as a sibling of `(tabs)/`, not inside it:** `(tabs)/layout.tsx` enforces a *member* gate (username redirect, nav chrome, TourProvider). The admin dashboard needs a *different* gate (owner-only) and *different* chrome (no bottom tab nav, no coachmark engine). Nesting it under `(tabs)` would inherit the wrong layout and force the username/tour machinery onto an internal tool. A separate route group keeps the two shells fully isolated.
- **`src/lib/analytics/` mirrors the existing `src/lib/` domain-module convention:** event definitions and the server/query clients are pure-ish modules, importable and (for `events.ts`/`metrics.ts`) unit-testable, exactly like `src/lib/money.ts` or `src/lib/period-stats.ts`.
- **`events.ts` as a single registry:** centralizing event names (`onboarding_step_completed`, `checkin_succeeded`, `settlement_recorded`, …) prevents the classic "typo'd event name" analytics rot and lets ANL-02 attach REQ-IDs as event properties from one place.
- **`src/lib/admin/auth.ts` separate from metrics:** the owner check is security-critical and reused by both `/admin/layout.tsx` and any future `/api/admin/*` route — give it one home, the way the codebase already isolates the Supabase client factories.

## Architectural Patterns

### Pattern 1: `instrumentation-client.ts` for init, separate client component for pageviews

**What:** Initialize the `posthog-js` singleton once in `src/instrumentation-client.ts` (the Next.js-blessed client bootstrap file). Disable automatic pageviews there and fire them manually from a small `"use client"` component mounted in the root layout, because the App Router does not trigger full page loads on client navigation.

**When to use:** Always, for App Router. This is the current PostHog-recommended pattern (preferred over a `PostHogProvider` purely for init, since init values are fixed for the session anyway).

**Trade-offs:** Pro — survives client navigations, no SSR/hydration issues, no provider re-render churn. Con — you must remember to fire pageviews yourself (`capture_pageview: false`).

**Example:**
```typescript
// src/instrumentation-client.ts
import posthog from "posthog-js";
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",              // reverse-proxied (Pattern 5)
  ui_host: "https://us.posthog.com",
  capture_pageview: false,          // App Router → manual
  capture_pageleave: true,
});

// src/components/analytics/posthog-pageview.tsx
"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";
export function PostHogPageview() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname, search]);
  return null;
}
// mount <Suspense><PostHogPageview/></Suspense> in app/layout.tsx (useSearchParams needs Suspense)
```

### Pattern 2: Server-side capture for trusted/financial events (`posthog-node`)

**What:** For events that must be truthful and cannot be forged by the client — check-in *verified*, settlement recorded, penalty enforced — capture from the server using `posthog-node` at the exact code path that already owns the truth (the API route or the enforcement cron), not from the browser.

**When to use:** Any event tied to money or server-authoritative state. Client capture is fine for UI/funnel events (button clicks, tab switches, coachmark steps).

**Trade-offs:** Pro — uncheatable, fires even if the client never loads JS (iOS Shortcut check-ins have *no* browser at all → server capture is the *only* way to track them). Con — must `await shutdown()` (or `flush()`) per serverless invocation or events get dropped when the function freezes; adds a few ms to the request.

**Example:**
```typescript
// src/lib/analytics/server.ts
import { PostHog } from "posthog-node";
export function serverAnalytics() {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1, flushInterval: 0,   // serverless: send immediately
  });
}
// in src/app/api/checkin/route.ts (or enforcement.ts) after verification succeeds:
const ph = serverAnalytics();
ph.capture({ distinctId: userId, event: "checkin_verified",
             properties: { method: "shortcut", group_id } });
await ph.shutdown();                // CRITICAL on Vercel
```
> Note: `api/checkin` and `api/cron` are *excluded* from middleware — that only affects session refresh, not server capture, which is independent. Good: the highest-value events (Shortcut check-ins, cron settlements) are exactly the ones with no client, so server capture is mandatory there.

### Pattern 3: Owner-only gate via a route-group layout (Supabase, not NextAuth)

**What:** Guard the entire `/admin` tree in `admin/layout.tsx` using the existing Supabase auth, comparing the authenticated user against an allow-list of owner IDs held in a server-only env var. Return `notFound()` (404) rather than `redirect("/login")` so the admin surface is invisible to non-owners (no "this exists but you can't have it" signal).

**When to use:** This single-owner/tiny-team internal dashboard. A DB `is_admin` column or a Postgres `admins` table is the heavier alternative if owners will grow or need per-feature roles — overkill for v1.2 (one owner).

**Trade-offs:** Env allow-list — zero migration, instant, but redeploy to change. DB flag — dynamic, RLS-enforceable, but needs a migration + an admin-management path. Recommend **env allow-list now**, leave a note to migrate to a DB flag if a second admin ever appears.

**Example:**
```typescript
// src/lib/admin/auth.ts (server-only)
import "server-only";
import { getAuthUser } from "@/lib/supabase/rsc";
const OWNER_IDS = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
export async function requireOwner() {
  const user = await getAuthUser();
  if (!user || !OWNER_IDS.includes(user.id)) return null;
  return user;
}
// src/app/admin/layout.tsx
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/admin/auth";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  if (!owner) notFound();           // invisible to non-owners
  return <div className="admin-shell">{children}</div>; // own chrome, no tab nav
}
```
> Reuse `getAuthUser()` from `src/lib/supabase/rsc.ts` — it's already `React.cache()`-memoized, so the layout + page share one auth round trip, matching the existing `(tabs)` pattern. Defense in depth: also call `requireOwner()` inside any `/api/admin/*` route (don't trust the layout alone), exactly as every existing route re-checks `auth.getUser()`.

### Pattern 4: RSC parallel-compose two data sources, hand plain data to client charts

**What:** The admin page is a Server Component. It fetches Supabase business metrics and PostHog HogQL results **in parallel** (`Promise.all`), then passes the resulting plain JSON down to small `"use client"` chart components. Charts never fetch — they receive props.

**When to use:** Every admin page mixing financial truth (Supabase) and product analytics (PostHog).

**Trade-offs:** Pro — one server round trip, no client API keys exposed, no loading spinners for the data itself, charts stay dumb/testable. Con — slowest source gates the page; mitigate with `Suspense` boundaries per card so financial data paints while PostHog queries stream.

**Example:**
```typescript
// src/app/admin/page.tsx (RSC)
import { getAdminMetrics } from "@/lib/admin/metrics";   // Supabase admin client
import { posthogQuery } from "@/lib/analytics/query";    // HogQL
import { TrendChart } from "./_components/trend-chart";
export const dynamic = "force-dynamic";
export default async function AdminOverview() {
  const [biz, checkinTrend] = await Promise.all([
    getAdminMetrics(),                                   // active pacts, avg stake, settlement rate
    posthogQuery("select toStartOfWeek(timestamp) wk, count() from events " +
                 "where event='checkin_verified' group by wk order by wk"),
  ]);
  return (<>
    <StatCard label="Active pacts" value={biz.activePacts} />
    <TrendChart data={checkinTrend.results} />          {/* client component */}
  </>);
}
```
```typescript
// src/lib/analytics/query.ts (server-only — personal API key NEVER reaches the client)
import "server-only";
export async function posthogQuery(hogql: string) {
  const res = await fetch(
    `${process.env.POSTHOG_HOST}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`,
    { method: "POST",
      headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY!}`,
                 "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
      next: { revalidate: 300 },     // cache 5 min — dashboards don't need real-time
    });
  if (!res.ok) throw new Error(`posthog_query_${res.status}`);
  return res.json() as Promise<{ results: unknown[][]; columns: string[] }>;
}
```

### Pattern 5: Reverse-proxy PostHog ingestion through `/ingest`

**What:** Route `posthog-js` traffic through your own domain via `next.config.mjs` rewrites so ad/tracker blockers (which block `*.posthog.com` directly) don't silently drop events — critical for funnel accuracy.

**When to use:** Always in production. Cheap insurance against under-counting.

**Trade-offs:** Pro — meaningfully higher capture rate. Con — adds rewrite rules; must also add `/ingest` to the middleware matcher *exclusions* (no session refresh needed on telemetry) and set PostHog `ui_host` so the toolbar still works.

**Example:**
```javascript
// next.config.mjs
async rewrites() {
  return [
    { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
    { source: "/ingest/:path*",        destination: "https://us.i.posthog.com/:path*" },
  ];
}
// next.config.mjs also needs: skipTrailingSlashRedirect: true
```

## Data Flow

### Event ingestion flow (out to PostHog)

```
Client UI action ──▶ posthog.capture() ──▶ /ingest/* (same-origin)
                                              │ Next rewrite
                                              ▼
Server truth event ──▶ posthog-node.capture()──▶  us.i.posthog.com  (events store)
   (checkin/cron)         + await shutdown()
```

### Dashboard read flow (in from both sources)

```
Owner hits /admin
    ↓
admin/layout.tsx → requireOwner() → (Supabase getAuthUser) → 404 if not owner
    ↓ pass
admin/page.tsx (RSC)
    ├── getAdminMetrics() ──▶ Supabase admin client ──▶ Postgres  (pacts, stakes, settlements)
    └── posthogQuery()    ──▶ HogQL Query API (Bearer personal key) ──▶ PostHog  (funnel, retention)
    ↓ Promise.all → plain JSON
client chart components (Recharts/shadcn) render
```

### Key Data Flows

1. **Onboarding funnel (ANL-01/ANL-02):** coachmark client fires `onboarding_step_completed` with `{ step_id, req_id }` → PostHog funnel insight → `/admin/funnel` reads it back via HogQL. The funnel is *defined* in PostHog from these events; the existing server-side `onboarding_progress` table stays the source of truth for resume/replay logic (do not derive product funnels from it — events are richer and time-stamped per attempt).
2. **Check-in rate over time:** `checkin_verified` / `checkin_geo_failed` captured **server-side** in `api/checkin` and the manual route → weekly aggregation via HogQL → trend chart. (Server capture is non-negotiable here: Shortcut check-ins have no browser.)
3. **Financial overview:** read **straight from Supabase** (settlements, group stakes) via the admin client in `src/lib/admin/metrics.ts` — never from PostHog. Money is Supabase-authoritative per the project constraints; PostHog financial events are for trend/volume only.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Everything as-is. `flushAt:1` server capture, 5-min-cached HogQL, single owner gate — all comfortable. |
| 1k-100k users | Watch HogQL query cost on the dashboard; lean harder on `next: { revalidate }` and consider pre-building PostHog **Insights** and reading saved-insight results instead of raw HogQL each load. Server `await shutdown()` per request is fine; consider batching non-critical server events. |
| 100k+ users | Move heavy dashboard aggregations to scheduled materialization (a cron writing daily rollups to a Supabase `admin_metrics_daily` table) rather than live HogQL; admin reads the rollup. This also de-risks PostHog API rate limits. |

### Scaling Priorities

1. **First bottleneck — PostHog Query API latency/rate on dashboard load.** Fix: aggressive `revalidate` caching (already in Pattern 4) + parallel `Promise.all`; charts behind per-card `Suspense` so the page never blocks on the slowest query.
2. **Second bottleneck — dropped server events under serverless concurrency.** Fix: ensure every server-capture path `await`s `shutdown()`/`flush()`; never fire-and-forget `posthog-node` on Vercel (the function freezes and the event is lost). This is the single most common PostHog-on-Vercel bug.

## Anti-Patterns

### Anti-Pattern 1: Wrapping the whole app in a `PostHogProvider` just to init

**What people do:** Create a `providers.tsx` client component that calls `posthog.init()` in `useEffect` and wraps `{children}` in root layout.
**Why it's wrong:** Forces the entire tree under a client boundary, can double-init under React strict mode, and init values are session-fixed anyway so the provider buys nothing. It also collides awkwardly with the existing server-driven `(tabs)` layout.
**Do this instead:** `instrumentation-client.ts` for init + a tiny `<PostHogPageview/>` client component for route-change pageviews (Pattern 1). Keep the rest of the tree server-rendered.

### Anti-Pattern 2: Querying PostHog from a client component (or shipping the personal API key)

**What people do:** `fetch('/api/projects/.../query')` from the dashboard client with the personal API key in `NEXT_PUBLIC_*`.
**Why it's wrong:** The **personal API key has account-wide read access** — exposing it in client bundles is a credential leak far worse than the project token. The project token (`NEXT_PUBLIC_POSTHOG_KEY`) is write-only and safe to ship; the **personal/query key must never be `NEXT_PUBLIC_`**.
**Do this instead:** Query only from RSC / server modules marked `import "server-only"` (Pattern 4). Two distinct keys: public project token (client, ingest) vs server personal key (dashboard reads).

### Anti-Pattern 3: Putting `/admin` inside the `(tabs)` group

**What people do:** Add `admin/` under `src/app/(tabs)/` to reuse the shell.
**Why it's wrong:** Inherits the username-redirect gate, the bottom tab nav, the TourProvider, and the coachmark engine — none of which belong on an internal owner tool, and the member gate is the *wrong* authorization boundary.
**Do this instead:** Separate `app/admin/` route group with its own `layout.tsx` and owner gate (Pattern 3).

### Anti-Pattern 4: Treating PostHog as a source of financial truth

**What people do:** Compute "settlement rate" or "amount owed" from PostHog events on the dashboard.
**Why it's wrong:** PostHog events are lossy (ad-blockers, dropped server flushes, sampling) and explicitly *not* the system of record. Money is Supabase-authoritative per project constraints.
**Do this instead:** Read all financial/pact metrics from Supabase (`src/lib/admin/metrics.ts`); use PostHog only for product/behavioral analytics (funnels, adoption, retention).

### Anti-Pattern 5: Forgetting middleware/matcher updates

**What people do:** Add `/ingest` and `/admin` without touching `middleware.ts`.
**Why it's wrong:** `/ingest` telemetry doesn't need (and shouldn't pay for) a Supabase session refresh; `/admin` *does* need session cookies fresh for the owner gate to work. The current matcher already excludes `api/checkin`/`api/cron` and static assets.
**Do this instead:** Add `ingest` to the matcher exclusion list (like `api/checkin`); leave `/admin` covered by middleware so the owner's session stays refreshed.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostHog Cloud (ingest) | `posthog-js` via `/ingest` reverse proxy; `posthog-node` server-side | Project token is `NEXT_PUBLIC_`; reverse proxy beats ad-blockers; `await shutdown()` server-side on Vercel |
| PostHog Query API (read) | RSC `fetch` POST to `/api/projects/:id/query/`, HogQL body, Bearer **personal** key | Server-only key; `query:read` scope; cache with `next.revalidate` (~5 min); default 100-row limit, up to 50k with explicit LIMIT |
| Supabase (dashboard reads) | Existing `createAdminClient()` (service-role, bypasses RLS) inside `src/lib/admin/metrics.ts` | Already server-only; reuse as-is — no new client factory needed |
| Vercel | env vars for both PostHog keys; Node runtime on admin + capture routes | `runtime = "nodejs"` already standard for admin-client routes; same here |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| client UI ↔ `src/lib/analytics/client.ts` | direct import, typed `capture()` wrappers | event names from `events.ts` registry — never raw strings at call sites |
| `api/checkin` & `cron/enforce` ↔ `src/lib/analytics/server.ts` | direct import inside existing handler, post-success | additive only — must not alter financial control flow; wrap in try/catch so a PostHog outage never fails a check-in |
| `/admin` RSC ↔ `src/lib/admin/metrics.ts` | direct async import | Supabase admin client; unit-test the pure aggregation shape with Vitest |
| `/admin` RSC ↔ `src/lib/analytics/query.ts` | direct async import | server-only HogQL; the only place the personal key is read |
| `/admin/layout.tsx` ↔ `src/lib/admin/auth.ts` | `requireOwner()` | reuses memoized `getAuthUser()` from `rsc.ts`; re-checked in any `/api/admin/*` |

## Suggested Build Order (for the roadmap)

1. **Analytics foundation** — `next.config.mjs` rewrites, `instrumentation-client.ts`, `PostHogPageview`, env keys, `events.ts` registry, middleware matcher update. Ship pageviews first; verify capture before anything else.
2. **Event instrumentation (ANL-01/02)** — client wrappers + sprinkle calls (coachmark steps with REQ-IDs, tab usage); **server capture** in `api/checkin` and `cron/enforce` (highest-value, no-browser events). Co-locate event-name tests.
3. **Admin shell + owner gate (ADMIN-01)** — `app/admin/` route group, `requireOwner()`, branded chrome, `notFound()` for non-owners. No data yet — prove the gate.
4. **Supabase-backed cards (ADMIN-04)** — `src/lib/admin/metrics.ts` + Vitest; financial/pact overview reads straight from Postgres. Independent of PostHog data latency.
5. **PostHog-backed cards (ADMIN-02/03/05/06)** — `query.ts` HogQL client, funnel/check-in-rate/adoption/retention charts; requires step 2's events to have accumulated.

> Order rationale: ingestion must exist before any dashboard can read it; the owner gate must exist before any data is exposed; Supabase cards can land before PostHog cards because they don't depend on event backfill, de-risking the dashboard's first visible win.

## Notable Decisions / Caveats

- **`@posthog/next` is pre-release** (as of research date PostHog explicitly flags it "not production-ready; API may change"). It bundles provider + server client + proxy + identity sync nicely, but for a shipping product use the **stable manual setup** (`posthog-js` + `posthog-node` + manual rewrites) described above. Revisit `@posthog/next` once it hits stable — it would collapse Patterns 1, 2, and 5 into one package.
- **Chart library:** no chart lib exists in the codebase today. Recommend **shadcn `chart` (Recharts)** — it's the natural fit for the existing shadcn/Radix/Tailwind stack and ships copy-in components, avoiding a heavyweight dependency. Add via the shadcn CLI; charts are client components fed by RSC data.
- **No existing owner/admin concept** in the schema (verified — no `is_admin`, no `admins` table; `role: "owner"` exists only on `group_members`, which is per-group, not platform-admin). The env allow-list (Pattern 3) introduces the platform-owner concept cleanly without a migration.

## Sources

- [PostHog — Next.js library docs](https://posthog.com/docs/libraries/next-js) — `instrumentation-client.ts` init, App Router pageviews, `posthog-node` server capture, reverse proxy (HIGH)
- [PostHog — `@posthog/next` package](https://posthog.com/docs/libraries/next-js/posthog-next) — confirmed **pre-release / not production-ready** as of research date; recommend manual setup instead (HIGH)
- [PostHog — Query API reference](https://posthog.com/docs/api/query) — HogQL `POST /api/projects/:id/query/`, Bearer personal key, `query:read` scope, row limits (HIGH)
- [PostHog — Next.js reverse proxy](https://posthog.com/docs/advanced/proxy/nextjs) — `/ingest` rewrites, `skipTrailingSlashRedirect` (HIGH)
- [Vercel KB — PostHog with Next.js App Router](https://vercel.com/kb/guide/posthog-nextjs-vercel-feature-flags-analytics) — Vercel-specific serverless flush guidance (MEDIUM)
- Existing codebase: `src/middleware.ts`, `src/app/layout.tsx`, `src/app/(tabs)/layout.tsx`, `src/lib/supabase/{rsc,server,admin,browser}.ts`, `src/app/api/groups/create/route.ts` (HIGH — direct read)

---
*Architecture research for: PostHog analytics + protected /admin dashboard in a Next.js 14 App Router monolith*
*Researched: 2026-06-20*
