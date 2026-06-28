# Phase 9: Admin Dashboard - Research

**Researched:** 2026-06-28
**Domain:** Owner-gated Next.js 14 App Router admin surface; Supabase aggregate queries + PostHog Query API (HogQL); recharts data viz
**Confidence:** HIGH (codebase patterns + schema verified directly; PostHog Query API verified against official docs; recharts verified against npm)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Route Structure & Access Gate**
- Plain `src/app/admin/` directory (no route group — URL is literally `/admin`)
- `requireOwner()` calls Next.js `notFound()` for non-owners — proper 404, no leak that route exists
- `ADMIN_USER_IDS` is a comma-separated string env var (`"uuid1,uuid2"`) split on `,` and trimmed
- `requireOwner()` lives in `src/lib/admin-auth.ts`
- `requireOwner()` uses `createClient()` (server cookie-bound) for the `getUser()` call — NOT `createAdminClient()` (identity must come from the session)

**Admin Layout & Shell**
- Minimal fixed header: "SweatPact Admin" left, single "Back to app" link right
- 2-column CSS grid desktop (`grid-cols-2`), single column mobile (`grid-cols-1`)
- All 6 panels on one scrollable page — Supabase block (financial, trend, users) first, PostHog block below
- No bottom tab nav, no TourProvider; standalone shell reusing the same brand Tailwind CSS vars
- Sits under root `PostHogProvider` (identity continuity) but does NOT inherit TourProvider/tab nav

**PostHog Data Strategy**
- Env var: `POSTHOG_PERSONAL_API_KEY`
- Cache: `next: { revalidate: 3600 }` (1 hour → 24 fetches/day)
- Empty state per PostHog panel: "No data yet — events started 2026-06-28"

**Charts & Visualization**
- `recharts` added as new dependency (shadcn-recommended chart lib)
- DASH-02 date range: URL searchParam `?range=7d|30d|90d` (default 30d), server component reads `searchParams.range`
- DASH-05 / DASH-06: metric cards with CSS percentage bars (no extra charting lib)

### Claude's Discretion
- Exact recharts component for DASH-02 (LineChart, multi-series suggested)
- PostHog HogQL query structure for funnel drop-off
- Error boundary strategy when PostHog API is unavailable (graceful fallback to empty state)
- Exact Tailwind classes for the data-dense layout

### Deferred Ideas (OUT OF SCOPE)
- ALRT-01 / ALRT-02 (alerting, weekly summary emails)
- ADV-01 (per-pair analytics view)
- ADV-03 (real-time dashboard with live event stream)
- Multi-admin / role-based admin access (env allow-list is correct for single owner)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | Protected `/admin` route; `requireOwner()` revalidates via `getUser()`, returns 404 for non-owners; owner = env-listed UUID (`ADMIN_USER_IDS`) | `src/lib/supabase/server.ts` `createClient()` + `notFound()`; fail-closed env parsing (Pitfall 4, Security V4) |
| ADMIN-02 | Admin layout uses SweatPact brand tokens, data-dense layout distinct from tab shell | Standalone `src/app/admin/layout.tsx`; reuse `globals.css` tokens + `src/components/ui/*` (UI-SPEC) |
| DASH-01 | Financial overview: active pact count, total stakes on line, total penalties issued, settlement completion rate — Supabase only | `groups`/`group_members`, `penalty_events`, `obligations`, `settlements` tables (Architecture + Open Q1) |
| DASH-02 | Check-in trend: weekly success count, geo-fail count, manual-vs-Shortcut split; 7d/30d/90d | `checkin_events` via `date_trunc('week', occurred_at)`. **geo-fail NOT in Supabase — see Pitfall 1** |
| DASH-03 | User overview: total registered, onboarding-completed, with active pact, checked in this week | `profiles`, `profiles.onboarding_complete`, `group_members`, `checkin_events`/`daily_status` |
| DASH-04 | Onboarding funnel drop-off from PostHog, cached with `next: { revalidate }` | HogQL over `onboarding:step_completed` event; `admin-posthog.ts` fetch client (Pattern 3) |
| DASH-05 | Feature adoption: tab usage, notification CTR, Shortcut setup rate from PostHog | `feature:*` events. **Notification CTR denominator gap — see Open Q2** |
| DASH-06 | Engagement & retention: DAU/WAU trend, avg streak length, 14-day churn from PostHog + Supabase | DAU/WAU from PostHog events; streak + churn from Supabase `daily_status`/`checkin_events` |
</phase_requirements>

## Summary

Phase 9 builds a read-only, owner-gated `/admin` dashboard. It is overwhelmingly a **codebase-pattern-reuse** phase: the project already has every primitive needed — RSC + `createAdminClient()` aggregate queries (`src/app/(tabs)/dashboard/page.tsx` is the reference implementation), server cookie-bound auth (`src/lib/supabase/server.ts`), the typed PostHog event catalog (`src/lib/analytics/events.ts`), brand tokens (`globals.css`), and a vendored shadcn/Radix UI kit. The only genuinely new pieces are: (1) the `requireOwner()` gate, (2) a PostHog **Query API** client (distinct from the existing ingestion client), and (3) the `recharts` dependency for the single line chart in DASH-02.

Two findings materially affect the plan and contradict surface-level assumptions in CONTEXT/UI-SPEC. **First: geo-fail check-ins are never written to `checkin_events`** — the `/api/checkin` route returns a 422 and emits only a PostHog `checkin:geo_failed` event, and the table's CHECK constraint only permits `verified`/`unverified`. So DASH-02's "geo-fail count" series cannot be Supabase-backed; it must come from PostHog (or the requirement re-scoped to "unverified count"). **Second: the PostHog Query API uses a different host than ingestion** — private endpoints are at `https://eu.posthog.com`, while the existing `src/lib/analytics/server.ts` correctly hardcodes `https://eu.i.posthog.com` for *ingestion only*. Copying that host into the Query API client will 404.

**Primary recommendation:** Mirror the existing dashboard RSC pattern (`export const dynamic = "force-dynamic"` + `createAdminClient()` for cross-user aggregates), add a fail-closed `requireOwner()` gate, build a `fetch()`-based PostHog Query API client (NOT the posthog-node SDK — the SDK doesn't support Next's `revalidate` caching), and render the DASH-02 chart as a `"use client"` recharts wrapper fed server-computed, ISO-week-bucketed data as props.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Owner access gate (ADMIN-01) | Frontend Server (RSC) | — | `requireOwner()` runs server-side in layout/page; `getUser()` revalidates session against Supabase auth server. Never client-side (spoofable). |
| Admin shell / layout (ADMIN-02) | Frontend Server (RSC layout) | Browser (recharts client island) | Layout + KPI cards are RSC; only the chart needs hydration. |
| Financial / user / trend aggregates (DASH-01/02/03) | API/Data (Supabase service-role) | Frontend Server | Cross-user aggregates require service-role (RLS bypass) — run server-only inside RSC. |
| Product analytics (DASH-04/05/06) | API/Data (PostHog Query API) | Frontend Server | HogQL executed server-side via authenticated fetch; result cached in Next Data Cache. |
| Chart rendering (DASH-02) | Browser | — | recharts uses hooks/SVG — must be a client component receiving data as props. |
| Date-range selection (DASH-02) | Frontend Server | Browser (link navigation) | `?range=` searchParam read server-side; no client state needed. |

## Standard Stack

### Core (already in repo — reuse, do not re-add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.35 | App Router, RSC, Data Cache, `notFound()` | Established [VERIFIED: package.json] |
| @supabase/supabase-js | 2.45.4 | Aggregate queries via `createAdminClient()` | Established [VERIFIED: package.json] |
| @supabase/ssr | 0.5.2 | Cookie-bound `createClient()` for `getUser()` | Established [VERIFIED: package.json] |
| posthog-node | 5.38.6 | **Ingestion only** (existing `server.ts`) — NOT for Query API | Established [VERIFIED: package.json] |
| zod | 3.23.8 | Validate `?range` searchParam + PostHog response shapes | Established, CLAUDE.md mandates Zod at boundaries [VERIFIED: package.json] |
| lucide-react | 0.468.0 | Icons | Established [VERIFIED: package.json] |
| tailwindcss | 3.4.13 | Brand tokens via `globals.css` CSS vars | Established [VERIFIED: package.json] |

### Supporting (new this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| recharts | 3.9.0 | DASH-02 multi-series LineChart | The shadcn-official chart library; only for DASH-02. DASH-05/06 use CSS bars. [VERIFIED: npm registry] [CITED: ui.shadcn.com/docs/components/chart] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | Hand-rolled SVG / CSS-only chart | A multi-series time chart with axes, tooltip, and 3 series is genuinely complex — see Don't Hand-Roll. recharts is the locked decision. |
| recharts | visx, Chart.js, nivo | recharts is shadcn's blessed lib and matches the project's React-component idiom; others add bundle weight or imperative canvas APIs. |
| posthog-node Query API helper | raw `fetch()` to Query API | **Use raw `fetch()`** — the SDK does not integrate with Next's `next: { revalidate }` Data Cache (Pitfall 2/3). |

**Installation:**
```bash
npm install recharts
```
`react-is` (recharts peer, `^16.8 || 17 || 18 || 19`) is already present transitively at 16.13.1 [VERIFIED: node require], so no separate install is required. If a strict CI flags the peer, add `react-is` explicitly.

**Version verification:** `npm view recharts version` → `3.9.0`, published 2026-06-23 [VERIFIED: npm registry]. Peer deps allow React `^18.0.0` [VERIFIED: npm view recharts peerDependencies] — compatible with the repo's React 18.3.1.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| recharts | npm | ~9 yrs | very high (multi-million/wk) | github.com/recharts/recharts | OK | Approved — shadcn-official, React-18 compatible, active (last publish 2026-06-23) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> recharts is recommended by the shadcn/ui chart docs (authoritative source) AND verified on the npm registry. No new transitive risk introduced; `react-is` peer already in tree.

## Architecture Patterns

### System Architecture Diagram

```
   Browser (owner)
        │  GET /admin?range=30d
        ▼
   middleware.ts ── refreshes Supabase session cookie (matcher already covers /admin)
        │
        ▼
   src/app/admin/layout.tsx  ──►  requireOwner()  ──►  src/lib/admin-auth.ts
        │                                                  │
        │                          createClient() (cookie-bound) .auth.getUser()
        │                                                  │
        │                          UUID ∈ ADMIN_USER_IDS ? ─── no ──► notFound()  → 404
        │                                                  │ yes
        ▼                                                  ▼
   src/app/admin/page.tsx  (export const dynamic = "force-dynamic")
        │
        ├─► Supabase block (createAdminClient — RLS bypass, runs every request)
        │     ├─ DASH-01 financial: groups/group_members, penalty_events, obligations, settlements
        │     ├─ DASH-02 trend:    checkin_events  ── date_trunc('week', occurred_at), filtered by ?range
        │     └─ DASH-03 users:    profiles, profiles.onboarding_complete, group_members, checkin_events
        │
        └─► PostHog block (src/lib/admin-posthog.ts)
              fetch POST https://eu.posthog.com/api/projects/{id}/query/
                   Authorization: Bearer POSTHOG_PERSONAL_API_KEY
                   body { query: { kind: "HogQLQuery", query: "SELECT ..." } }
                   next: { revalidate: 3600 }     ← cached in Next Data Cache
                ├─ DASH-04 funnel:     HogQL over onboarding:step_completed
                ├─ DASH-05 adoption:   HogQL over feature:* events
                └─ DASH-06 engagement: HogQL DAU/WAU  +  Supabase (streak, 14-day churn)
        │
        ▼
   DASH-02 data ──► <CheckinTrendChart/> ("use client" recharts island, data via props)
```

Data flow note: `force-dynamic` makes the route render per-request, so Supabase financial figures are always live. The PostHog `fetch()` calls still hit the **Next Data Cache** (fetch-level `revalidate` is independent of route dynamics), so they respect the 1-hour cache window even inside a dynamic route.

### Recommended Project Structure
```
src/
├── app/
│   └── admin/
│       ├── layout.tsx          # standalone shell; calls requireOwner(); fixed header + grid
│       ├── page.tsx            # RSC; export const dynamic = "force-dynamic"; orchestrates 6 panels
│       ├── error.tsx           # "use client" route error boundary (whole-page fallback copy)
│       └── loading.tsx         # optional skeleton
├── components/
│   └── admin/
│       ├── checkin-trend-chart.tsx   # "use client" recharts LineChart (DASH-02)
│       ├── financial-overview.tsx    # DASH-01 KPI card (RSC, props)
│       ├── user-overview.tsx         # DASH-03 (RSC, props)
│       ├── onboarding-funnel.tsx     # DASH-04 (RSC, props + empty state)
│       ├── feature-adoption.tsx      # DASH-05 (RSC, props + empty state)
│       ├── engagement-panel.tsx      # DASH-06 (RSC, props + empty state)
│       └── range-control.tsx         # segmented 7d/30d/90d Links (no client state)
└── lib/
    ├── admin-auth.ts           # requireOwner(); parseAdminUserIds() (pure, testable)
    ├── admin-metrics.ts        # pure: settlementRate(), bucketCheckinsByWeek(), etc. (testable)
    └── admin-posthog.ts        # fetch-based Query API client + HogQL builders + response Zod schemas
```

### Pattern 1: Owner gate (fail-closed)
**What:** Server-only function that 404s anyone not in the allow-list.
**When to use:** Top of `admin/layout.tsx` (and any future admin page).
```typescript
// src/lib/admin-auth.ts  — Source: existing createClient() pattern + Next notFound()
import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export function parseAdminUserIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean); // empty/missing env → [] → nobody is admin (fail-closed)
}

export async function requireOwner(): Promise<string> {
  const allow = parseAdminUserIds(process.env.ADMIN_USER_IDS);
  if (allow.length === 0) notFound();                  // never open the door on misconfig
  const supabase = createClient();                     // cookie-bound — identity from session
  const { data, error } = await supabase.auth.getUser(); // revalidates against auth server
  const uid = data.user?.id;
  if (error || !uid || !allow.includes(uid)) notFound();
  return uid;
}
```
`getUser()` (not `getSession()`) is mandatory: `getSession()` only decodes the cookie and is spoofable; `getUser()` round-trips to Supabase auth. `notFound()` (not `redirect`/403) means an attacker can't distinguish "route doesn't exist" from "you're not allowed."

### Pattern 2: Cross-user Supabase aggregates (DASH-01/02/03)
**What:** Service-role client for whole-table aggregates that RLS would otherwise scope to one user.
**When to use:** All three Supabase-backed panels.
```typescript
// Source: src/app/(tabs)/dashboard/page.tsx (lines 86-94 use createAdminClient for cross-scope counts)
export const dynamic = "force-dynamic";
const admin = createAdminClient();
const [{ count: userCount }, { data: weekBuckets }] = await Promise.all([
  admin.from("profiles").select("id", { count: "exact", head: true }),
  admin.rpc("checkins_by_week", { range_days: rangeDays }), // or inline select with date_trunc
]);
```
Prefer `date_trunc('week', occurred_at)` server-side (Postgres, via an RPC or a view) over JS week-bucketing — matches the CONTEXT "specific idea" and avoids timezone drift in the client.

### Pattern 3: PostHog Query API client (DASH-04/05/06)
**What:** Authenticated `fetch()` to the HogQL Query endpoint with Next Data-Cache revalidation.
**When to use:** Every PostHog-backed panel.
```typescript
// src/lib/admin-posthog.ts — Source: posthog.com/docs/api/queries (endpoint, body, auth)
import "server-only";

const HOST = "https://eu.posthog.com"; // PRIVATE/auth endpoints — NOT eu.i.posthog.com (ingestion)

export async function runHogQL<T>(query: string): Promise<T[] | null> {
  const projectId = process.env.POSTHOG_PROJECT_ID;       // server-side id
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!projectId || !key) return null;                    // empty-state fallback
  try {
    const res = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      next: { revalidate: 3600 },                         // 1-hour Data Cache
    });
    if (!res.ok) return null;                             // error → panel shows empty/error state
    const json = await res.json();
    return json.results as T[];                           // validate with Zod before use
  } catch {
    return null;                                          // analytics must never break the page
  }
}
```
HogQL response shape is `{ results: [[col1, col2, ...], ...], columns: [...] }` — index into rows by column order; validate with a Zod tuple/array schema before mapping.

### Pattern 4: recharts client island
**What:** recharts is client-only (hooks + ResponsiveContainer); the RSC page passes pre-computed data.
```tsx
// src/components/admin/checkin-trend-chart.tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
export function CheckinTrendChart({ data }: { data: WeekBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid stroke="hsl(0 0% 18%)" strokeOpacity={0.4} />
        <XAxis dataKey="week" stroke="hsl(0 0% 60%)" />
        <YAxis stroke="hsl(0 0% 60%)" />
        <Tooltip /* style to glass-card via contentStyle */ />
        <Line dataKey="verified" stroke="hsl(142 71% 45%)" dot={false} />
        <Line dataKey="total"    stroke="hsl(0 0% 100%)"   dot={false} />
        {/* geo-fail series: see Pitfall 1 — source decision required */}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Anti-Patterns to Avoid
- **Gating in middleware instead of the layout** — `/admin` is in the middleware matcher only for session refresh; do the authorization in `requireOwner()`, not middleware (matcher edits are fragile and Edge-runtime can't use the admin client).
- **`NEXT_PUBLIC_` on the PostHog personal key or project id used for Query API** — the personal API key is a server secret; never expose it. (Ingestion key `NEXT_PUBLIC_POSTHOG_KEY` is public and separate.)
- **Reusing the ingestion host (`eu.i.posthog.com`) for the Query API** — Query API is at `eu.posthog.com` (Pitfall 2).
- **Rendering recharts in an RSC** — it will error; must be `"use client"`.
- **Inline JS week math** — use Postgres `date_trunc` (CONTEXT decision + avoids DST drift).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-series time-series chart | Custom SVG/CSS line chart | `recharts` LineChart | Axes, scales, tooltips, responsive resize, multi-series alignment are deceptively hard; recharts is the locked choice |
| Currency display | Manual rupee formatting | `formatCents()` from `@/lib/money` | Already handles INR `Intl.NumberFormat` + cents→rupees [VERIFIED: src/lib/money.ts] |
| Session auth / identity | Decode JWT manually | `supabase.auth.getUser()` | Revalidates against auth server; manual decode is spoofable |
| Per-request → cross-request cache | Custom in-memory cache | Next `fetch` `next: { revalidate }` | Built into the Data Cache; survives serverless cold paths |
| Week bucketing | JS date loops | Postgres `date_trunc('week', occurred_at)` | Server-side, timezone-correct, avoids client math |
| Input validation of `?range` | `if/else` string checks | Zod enum `z.enum(["7d","30d","90d"])` | CLAUDE.md mandates Zod at boundaries; whitelist prevents injection into query params |

**Key insight:** This phase introduces almost no new problem domains — nearly every need maps to an existing repo utility or a one-line library call. The only justified new dependency is recharts.

## Common Pitfalls

### Pitfall 1: DASH-02 "geo-fail count" is NOT in Supabase  ⚠️ HIGH IMPACT
**What goes wrong:** The plan assumes geo-failed check-ins can be counted from `checkin_events`, but they can't.
**Why it happens:** `/api/checkin/route.ts` returns a 422 on geo-fail (when `source === "shortcut"` or `!allow_unverified`) and writes **no row** — it only emits the PostHog event `checkin:geo_failed` [VERIFIED: src/app/api/checkin/route.ts lines 147-159]. The table's CHECK constraint allows only `status in ('verified','unverified')` [VERIFIED: supabase/migrations/0001_init.sql]. So the "geo-fail" series has no Supabase source.
**How to avoid:** Pick one explicitly in the plan (recommend confirming with user — see Open Q3):
  1. Source the geo-fail series from PostHog (`checkin:geo_failed` HogQL), making DASH-02 a Supabase+PostHog hybrid; OR
  2. Re-scope the third series to "unverified count" (which *is* in `checkin_events`).
Note: `unverified` rows only get written for `source === "manual"` with `allow_unverified=true`; shortcut geo-fails are never persisted.
**Warning signs:** A query selecting `status = 'geo_fail'` returns zero rows always.

### Pitfall 2: PostHog Query API uses a different host than ingestion  ⚠️
**What goes wrong:** Copying `https://eu.i.posthog.com` from `server.ts` into the Query API client → 404/auth errors.
**Why it happens:** EU public/ingestion endpoints live at `eu.i.posthog.com`; private/authenticated endpoints (the Query API) live at `https://eu.posthog.com` [CITED: posthog.com/docs/api — "On EU Cloud these are https://eu.i.posthog.com for public endpoints and https://eu.posthog.com for private ones"].
**How to avoid:** Hardcode `https://eu.posthog.com` in `admin-posthog.ts`; do not reuse `NEXT_PUBLIC_POSTHOG_HOST` (which is `/ingest`, a browser-only reverse proxy).
**Warning signs:** 404 or HTML response instead of JSON from the query call.

### Pitfall 3: posthog-node SDK doesn't cache via Next
**What goes wrong:** Using `posthog-node` for the Query API bypasses the Data Cache; every render re-hits PostHog and can trip the rate limit.
**Why it happens:** The SDK uses its own HTTP layer; `next: { revalidate }` only applies to the native `fetch`.
**How to avoid:** Use raw `fetch()` (Pattern 3) for the Query API. Keep `posthog-node` for ingestion only.
**Warning signs:** Rate-limit (429) responses; PostHog usage dashboard shows one query per page load.

### Pitfall 4: Empty/misconfigured `ADMIN_USER_IDS` must fail closed
**What goes wrong:** A naive split of an undefined env (`"".split(",")` → `[""]`) can accidentally match, or an empty list could be treated as "allow all."
**Why it happens:** Off-by-one in parsing; defaulting open on missing config.
**How to avoid:** `parseAdminUserIds()` filters falsy entries; `requireOwner()` calls `notFound()` when the list is empty (Pattern 1). Unit-test both branches.
**Warning signs:** Non-owner gains access in an env where `ADMIN_USER_IDS` is unset.

### Pitfall 5: `getUser()` vs `getSession()`
**What goes wrong:** Using `getSession()` for the gate lets a forged cookie pass.
**How to avoid:** Use `getUser()` (revalidates server-side). CONTEXT already locks this.

### Pitfall 6: recharts in a Server Component
**What goes wrong:** Importing recharts into `page.tsx` throws (it needs the browser).
**How to avoid:** Isolate the chart in a `"use client"` component; pass data as serializable props.

### Pitfall 7: `force-dynamic` + fetch caching coexistence
**What goes wrong:** Worry that `export const dynamic = "force-dynamic"` disables the PostHog `revalidate`.
**Reality:** `force-dynamic` controls route rendering; `fetch`-level `revalidate` still stores results in the Data Cache. Supabase admin queries (supabase-js, not `fetch`) correctly re-run each request → live financials. This split is desirable, not a bug.

## Runtime State Inventory

> Greenfield additive phase (new `/admin` route + 3 new env vars). No renames/migrations of existing state. Listed for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — phase reads existing tables, writes nothing. | None |
| Live service config | PostHog project must have a **Personal API Key with "Query Read" scope** generated; the dashboard reads but does not configure PostHog. | Generate key in PostHog UI; store as `POSTHOG_PERSONAL_API_KEY` |
| OS-registered state | None. | None |
| Secrets/env vars | 3 new vars: `ADMIN_USER_IDS`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` (server-side; CONTEXT suggested `NEXT_PUBLIC_POSTHOG_PROJECT_ID` but project id for the Query API should be server-only). Existing reused: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`. | Add to `.env.example`, `.env.local`, and Vercel env (all environments) |
| Build artifacts | None. | None |

## Code Examples

### Settlement completion rate (DASH-01, pure + testable)
```typescript
// src/lib/admin-metrics.ts
export function settlementRate(settled: number, pending: number): number {
  const total = settled + pending;
  return total === 0 ? 0 : settled / total; // penalties settled ÷ penalties owed
}
```
Source data: `obligations.status` — `settled` count vs `pending` count [VERIFIED: supabase/migrations/0001_init.sql obligations CHECK status in ('pending','settled','disputed','voided')].

### DASH-03 user-overview queries (shape)
```typescript
const admin = createAdminClient();
const [{ count: total }, { count: onboarded }] = await Promise.all([
  admin.from("profiles").select("id", { count: "exact", head: true }),
  admin.from("profiles").select("id", { count: "exact", head: true }).eq("onboarding_complete", true),
]);
// active pact: distinct user_id in group_members; checked-in-this-week: distinct
// user_id in checkin_events where local_day >= isoWeekMonday(today) and status='verified'
```
`profiles.onboarding_complete` exists [VERIFIED: supabase/migrations/0014_onboarding_complete.sql].

### DASH-04 funnel HogQL (drop-off by step)
```sql
-- onboarding:step_completed carries a step id property (from INSTR-01).
SELECT properties.step_id AS step, count(DISTINCT person_id) AS users
FROM events
WHERE event = 'onboarding:step_completed'
GROUP BY step
ORDER BY users DESC
```
Confirm the exact step-id property name against the Phase 8 INSTR-01 implementation before finalizing.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PostHog Query API legacy 120 req/hr | Query endpoint now **2400/hr** (some legacy accounts still 120/hr) | per current PostHog docs | `revalidate: 3600` (24/day) is comfortably within either limit; CONTEXT's 120/hr is the conservative number — keep the cache regardless [CITED: posthog.com/docs/endpoints/rate-limits] |
| recharts 2.x (React 16-18) | recharts 3.x (React 16.8-19) | 3.0 GA 2025 | 3.9.0 is current and React-18 compatible [VERIFIED: npm] |

**Deprecated/outdated:**
- Do not use `getSession()` for authorization (PostHog/Supabase guidance) — use `getUser()`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Active pact" = a `group` with ≥2 `group_members` (or an `accepted` `challenge_invitation`). The schema has no explicit `is_active` flag. | DASH-01 / Open Q1 | Wrong count of active pacts and wrong "total stakes on the line" denominator |
| A2 | "Total stakes on the line" = sum of per-pact penalty (`challenge_invitations.penalty_cents` for accepted pacts, or `groups.default_penalty_cents`). | DASH-01 / Open Q1 | Stakes figure misreports |
| A3 | DASH-04 step identity property is named `step_id` on `onboarding:step_completed`. | DASH-04 | Funnel groups by the wrong property → empty/incorrect funnel |
| A4 | `POSTHOG_PROJECT_ID` should be server-only (CONTEXT floated `NEXT_PUBLIC_` variant). | Env vars | Minor: project id is not highly sensitive, but server-only is cleaner |
| A5 | "Total penalties issued" counts/sums `penalty_events` (not `obligations`). | DASH-01 | Double-counting if pacts split a penalty into two obligations |

## Open Questions (RESOLVED)

1. **What defines an "active pact" and its stake?**
   - What we know: `groups` + `group_members` (one group per user, `unique(user_id)`), `challenge_invitations` (status `pending|accepted|declined|cancelled|expired`, `penalty_cents`), `groups.default_penalty_cents`. No boolean "active" column.
   - What's unclear: whether "active" = group with 2 members, or group with an `accepted` invitation, and which field holds the stake amount.
   - Recommendation: Plan should define active-pact as a group with ≥2 members AND surface the chosen stake field; confirm during plan-check or with user.
   - **RESOLVED (Plan 02):** Active pact = group with ≥2 members in `group_members`; stake = `groups.default_penalty_cents` for that group.

2. **Notification CTR denominator (DASH-05) has no PostHog "sent" event.**
   - What we know: `feature:notification_clicked` is captured client-side (INSTR-05); there is no `notification_sent` event in `events.ts`.
   - What's unclear: CTR = clicked ÷ sent — but "sent" lives in the push pipeline (`src/lib/push.ts`), not PostHog.
   - Recommendation: Either (a) compute CTR with a Supabase/push "sent" count as denominator, (b) re-scope DASH-05 to show click counts only, or (c) add a sent event (likely out of scope — Phase 8 is closed). Flag for user.
   - **RESOLVED (Plan 05):** Show click count only, labeled "Notification clicks" — no denominator fabricated. Comment in `feature-adoption.tsx` documents the missing-sent-event limitation.

3. **DASH-02 geo-fail series source (see Pitfall 1).** Recommendation: source from PostHog `checkin:geo_failed`, or re-scope to "unverified." Needs explicit decision.
   - **RESOLVED (Plans 02+03):** Geo-fail series sourced from PostHog `checkin:geo_failed` event via `geoFailByWeekQuery(days)` HogQL; merged into Supabase week buckets via `mergeGeoFailByWeek` before passing to `CheckinTrendChart`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase service-role key | DASH-01/02/03 | ✓ (existing) | — | none needed |
| PostHog Personal API Key (Query Read) | DASH-04/05/06 | ✗ (must be generated) | — | Panels render empty state if key absent (`runHogQL` returns null) |
| PostHog project id | DASH-04/05/06 | ✗ (must be set) | — | Same empty-state fallback |
| recharts | DASH-02 | ✗ (install) | 3.9.0 | none — required for chart |
| Node 20.x | runtime | ✓ | 20.x | — [VERIFIED: package.json engines] |

**Missing dependencies with no fallback:** recharts (install via `npm install recharts`).
**Missing dependencies with fallback:** PostHog Query API key + project id — panels degrade to the locked empty state when unset, so the page still renders for owner.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` (`vitest run --pool=threads`) |
| Full suite command | `npm run test` |

There is no React Testing Library / component-render harness in the repo (tests are pure `src/lib/*.test.ts`). Keep verification on **pure functions**; component/visual checks are manual (UAT).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | `parseAdminUserIds()` handles unset/empty/whitespace/multi | unit | `vitest run src/lib/admin-auth.test.ts` | ❌ Wave 0 |
| ADMIN-01 | `requireOwner()` calls `notFound()` for non-listed/empty-env (mock supabase + notFound) | unit | `vitest run src/lib/admin-auth.test.ts` | ❌ Wave 0 |
| DASH-01 | `settlementRate()` (0 total → 0; ratios) | unit | `vitest run src/lib/admin-metrics.test.ts` | ❌ Wave 0 |
| DASH-02 | `bucketCheckinsByWeek()` / range→days mapping; Zod `?range` enum | unit | `vitest run src/lib/admin-metrics.test.ts` | ❌ Wave 0 |
| DASH-04/05/06 | HogQL response parser/Zod schema maps rows→typed metrics; null on bad shape | unit | `vitest run src/lib/admin-posthog.test.ts` | ❌ Wave 0 |
| ADMIN-02 / all panels | Rendering, layout, brand tokens, empty states | manual (UAT) | — | n/a (no RTL) |

### Sampling Rate
- **Per task commit:** `npm run test` (whole suite is fast) + `npm run typecheck`
- **Per wave merge:** `npm run test` + `npm run lint`
- **Phase gate:** Full suite green + `npm run build` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/admin-auth.test.ts` — covers ADMIN-01 (parse + gate branches)
- [ ] `src/lib/admin-metrics.test.ts` — covers DASH-01 (settlement rate) and DASH-02 (range/bucket helpers)
- [ ] `src/lib/admin-posthog.test.ts` — covers HogQL response parsing (DASH-04/05/06)
- [ ] Extract pure logic out of RSC components into `admin-auth.ts` / `admin-metrics.ts` / `admin-posthog.ts` so it is testable (components stay thin)

## Security Domain

> `security_enforcement: true`, ASVS Level 1. The owner gate is the single most security-critical control in this phase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase session; `getUser()` revalidation (not `getSession()`) |
| V3 Session Management | yes | Session cookie refreshed by existing middleware; no new session state |
| V4 Access Control | **yes (critical)** | `requireOwner()` allow-list + `notFound()`; fail-closed on empty/missing `ADMIN_USER_IDS`; authorization in RSC, not client/middleware |
| V5 Input Validation | yes | Zod `z.enum(["7d","30d","90d"])` for `?range`; validate PostHog response shape with Zod before use |
| V6 Cryptography | yes | `SUPABASE_SERVICE_ROLE_KEY` and `POSTHOG_PERSONAL_API_KEY` server-only (never `NEXT_PUBLIC_`) |
| V7 Error Handling/Logging | yes | PostHog/Supabase failures degrade to empty/error states, never leak stack traces to the client (mirror dashboard try/catch that re-throws Next signals) |

### Known Threat Patterns for {Next.js RSC + Supabase + PostHog Query API}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged session cookie to reach `/admin` | Spoofing | `getUser()` server-side revalidation |
| Route-existence enumeration | Information Disclosure | `notFound()` (404), not 403/redirect |
| Misconfigured empty allow-list opens admin | Elevation of Privilege | Fail-closed: empty list → `notFound()` for everyone |
| Personal API key / service-role key leak to client | Information Disclosure | Keep both server-only; `import "server-only"` in `admin-auth.ts`, `admin-posthog.ts` |
| `?range` injected into SQL/HogQL | Tampering / Injection | Zod enum whitelist → map to fixed integer day counts; never interpolate raw input into HogQL |
| HogQL string interpolation of any external value | Injection | DASH-04/05/06 queries should be static strings; no user-controlled interpolation |
| Cross-user data exposure via RLS bypass | Information Disclosure | `createAdminClient()` is intended here (aggregates), but the route is owner-only — acceptable; never expose admin client to non-owner code paths |

## Sources

### Primary (HIGH confidence)
- Codebase (verified directly): `src/app/(tabs)/dashboard/page.tsx`, `src/lib/supabase/{admin,rsc,server}.ts`, `src/lib/analytics/{events,server}.ts`, `src/app/api/checkin/route.ts`, `src/middleware.ts`, `next.config.mjs`, `supabase/migrations/0001_init.sql`, `0010`, `0014`, `0030`, `src/components/ui/card.tsx`, `src/lib/money.ts`, `package.json`
- npm registry: `recharts@3.9.0` (peer deps, publish date) [VERIFIED]
- posthog.com/docs/api/queries — Query API endpoint, body, auth [CITED]
- posthog.com/docs/api , /docs/endpoints/rate-limits — EU host split, rate limits [CITED]

### Secondary (MEDIUM confidence)
- ui.shadcn.com/docs/components/chart — recharts as the blessed chart lib [CITED]

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against package.json + npm
- Architecture: HIGH — directly mirrors the existing dashboard RSC + admin-client pattern
- Pitfalls: HIGH — geo-fail/host findings verified in source code and official docs
- DASH-01 active-pact/stake semantics: MEDIUM — schema lacks explicit "active" flag (Open Q1)
- DASH-05 CTR denominator: MEDIUM — no "sent" event exists (Open Q2)

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable stack; PostHog rate-limit policy is the most likely thing to drift)
</content>
</invoke>
