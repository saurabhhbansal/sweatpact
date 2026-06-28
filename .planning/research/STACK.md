# Stack Research

**Domain:** Analytics instrumentation + custom admin dashboard for an existing Next.js 14 App Router PWA (brownfield, SweatPact v1.2)
**Researched:** 2026-06-20
**Confidence:** HIGH

> Scope: ONLY the **new** capabilities for v1.2 — PostHog event tracking, server-side PostHog querying, and the `/admin` dashboard UI. The existing stack (Next.js 14, React 18, TypeScript strict, Tailwind, shadcn/Radix, Supabase RLS, Zod, Vercel) is unchanged and not re-evaluated here.

## TL;DR Recommendation

Add **`posthog-js`** (client capture) + **`posthog-node`** (server-authoritative capture) for instrumentation, and build the `/admin` dashboard with **`recharts@3`** consumed through **shadcn's official `chart` component** so charts inherit SweatPact's Tailwind brand tokens instead of looking like a generic SaaS panel. Query analytics for the dashboard via PostHog's **HogQL `/query` API** with a server-only personal API key, called by fetch from Node-runtime server components/route handlers. Keep client autocapture off; capture **named** events keyed to the existing REQ-IDs. One compatibility gotcha: **`posthog-node@5` requires Node 20.20+/22.22+**, above the "Node 18+" baseline in CLAUDE.md.

## Recommended Stack

### Core Technologies (new dependencies)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `posthog-js` | `^1.391.2` | Client-side event capture, funnel source (onboarding drop-off, tab usage, CTRs) | Official PostHog browser SDK; the only first-party way to instrument client interactions. Pairs natively with App Router via `instrumentation-client.ts`. Generous free tier covers SweatPact's scale. |
| `posthog-node` | `^5.38.2` | Server-side capture of authoritative events (penalties, settlements, verified/geo-failed check-ins) | Financial/pact events are already server-authoritative in `src/lib/`. Capturing them server-side keeps analytics correctness aligned with the project's "clients cannot forge verified status" constraint — client events can be blocked or forged. **Requires Node `^20.20.0 \|\| >=22.22.0`** (see Version Compatibility). |
| `recharts` | `^3.8.1` | Charting primitive for all `/admin` visualizations (funnel bars, check-in trend lines, retention) | shadcn/ui's official `chart` component is built on **Recharts v3**. Choosing recharts keeps the dashboard inside the existing shadcn/Tailwind design system rather than introducing a foreign chart aesthetic — directly supports the "no corporate SaaS dashboard UX" out-of-scope guard. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `chart` component | (CLI-generated, not an npm package) | Themeable `ChartContainer` / `ChartTooltip` / `ChartLegend` wrappers around recharts using CSS variables | Add via `npx shadcn@latest add chart`. Use for **every** chart so colors come from existing Tailwind tokens — this is what makes recharts feel native to SweatPact's brand. |
| `date-fns` | `^4.4.0` | Date formatting + range math for time-bucketed metrics (weekly check-in trend, DAU/WAU windows) | Only for display formatting / simple range arithmetic. SweatPact already does IANA-zone math in `src/lib/time.ts` — reuse that for anything timezone-sensitive; do not duplicate it. Skippable if `time.ts` already covers the need. |
| `react-day-picker` | `^8.10.2` | Calendar primitive behind a shadcn date-range picker | Only if admin dashboards need an interactive custom date-range selector. **Defer for MVP** — start with fixed presets (7d/30d/90d) as buttons, which need no new dependency. |
| `@tanstack/react-table` | `^8.21.3` | Headless data-table for large tabular admin views (per-user retention, settlement breakdowns) | Only when a metric is genuinely tabular and large/sortable. For small fixed lists a plain styled `<table>` is lighter. Add via shadcn `data-table` recipe rather than hand-rolling. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| PostHog Personal API Key (Query Read) | Auth for server-side HogQL querying from `/admin` | **Server-only** env var (no `NEXT_PUBLIC_` prefix). Treat like the service-role key — never ship to client. Scope to **Query Read** only. |
| `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` | Client SDK init (project token + ingestion host) | Public by design (project token, not API key). Set host to `https://us.i.posthog.com` (or EU host) — or a same-origin reverse-proxy path (see Stack Patterns). |
| Vitest (existing) | Unit-test pure metric/transform logic | Keep HogQL-result → chart-data shaping in pure `src/lib/analytics/` modules and test those, not the dashboard DOM. Matches existing domain-layer pattern. |

## Installation

```bash
# Core — PostHog SDKs
npm install posthog-js@^1.391.2 posthog-node@^5.38.2

# Charts — recharts is pulled in by the shadcn chart component; install explicitly to pin
npm install recharts@^3.8.1
npx shadcn@latest add chart

# Optional admin-UI helpers (add only when the feature needs them)
npm install date-fns@^4.4.0
npx shadcn@latest add calendar          # date-range picker — pulls react-day-picker@^8 (defer for MVP)
npx shadcn@latest add table data-table  # large tabular views only — wraps @tanstack/react-table@^8
```

No new dev dependencies beyond the existing toolchain.

## Integration Points (with existing SweatPact stack)

| New piece | Hooks into existing | How |
|-----------|---------------------|-----|
| `posthog-js` client init | Root layout / providers | Add `instrumentation-client.ts` (or a `"use client"` `PostHogProvider`) mounted once. Identify users with the Supabase `auth.getUser()` id so events join to real accounts. |
| `posthog-node` server capture | `src/lib/` domain modules + `src/app/api/**/route.ts` | Capture authoritative events (settlement created, penalty applied, check-in verified/geo-failed) right where the domain logic runs. Always `await posthog.shutdown()` before the handler returns (serverless = no background flush). |
| Onboarding funnel (ANL-02) | `onboarding_progress` PATCH flow / CoachmarkRenderer (v1.1) | Emit one PostHog event per step with the existing REQ-IDs (TEACH-01…06) as properties so funnel drop-off maps 1:1 to requirements. |
| `/admin` data fetching | Existing RSC + privilege-scoped Supabase clients | Query PostHog via `fetch` to `/api/projects/:id/query/` from **server components / route handlers** (Node runtime, never Edge). Some metrics (active pacts, avg stake, settlement rate) come from **Supabase directly**, not PostHog — see note below. |
| `/admin` owner-only gate (ADMIN-01) | Same auth pattern as other protected routes | Re-check `auth.getUser()` server-side and compare against an allowlist/owner flag. Note CONCERNS.md: authorization is re-implemented per route with no shared middleware — keep the gate explicit and server-side. |
| recharts + shadcn `chart` | Tailwind theme tokens in `tailwind.config.ts` | Chart colors resolve from CSS variables — reuse existing brand colors so dashboards match the app, not a generic gray grid. |

> **Data-source split:** PostHog is the source for behavioral/funnel/engagement metrics (ANL/ADMIN-02, -03 partial, -05, -06). Financial & pact overview (ADMIN-04) and exact check-in/settlement truth (ADMIN-03, -04) live in **Supabase Postgres** — query those with the existing server/admin Supabase clients, not PostHog. Don't route money metrics through analytics events.

## PostHog Server-Side Query Pattern

```
POST {NEXT_PUBLIC_POSTHOG_HOST}/api/projects/:project_id/query/
Authorization: Bearer <POSTHOG_PERSONAL_API_KEY>   # server-only, Query Read scope
Content-Type: application/json

{ "query": { "kind": "HogQLQuery", "query": "SELECT ... FROM events WHERE timestamp >= now() - INTERVAL 7 DAY" } }
```

- Default 100 rows; set an explicit `LIMIT` for up to 50,000.
- Wrap the response in **Zod** parsing at the boundary (matches project convention).
- Force Node runtime on `/admin` server code: `export const runtime = "nodejs"`.
- The `/query` endpoint is **not** an export pipeline — PostHog reserves the right to throttle/break export-shaped queries. Aggregate dashboard queries are fine; do not build batch exports on it.

## Client/Server Init Pattern (App Router)

- **Client:** `instrumentation-client.ts` → `posthog.init(NEXT_PUBLIC_POSTHOG_KEY, { api_host: NEXT_PUBLIC_POSTHOG_HOST })`. (Official guide no longer requires a separate provider, but a thin `"use client"` `PostHogProvider` is fine if you want `usePostHog()` in components.)
- **Server:** a reusable `PostHogClient()` factory using `posthog-node` with `flushAt: 1, flushInterval: 0`, then `await client.shutdown()` after capturing — required for serverless so events flush before the function freezes.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `recharts@3` (via shadcn chart) | `tremor`, `nivo`, `visx`, Chart.js | Tremor only if you wanted a pre-built dashboard kit — but it brings its own design language that fights SweatPact's brand and the "no corporate SaaS dashboard" guard. visx/nivo only for a chart type recharts can't render. None justified here. |
| Self-querying PostHog `/query` API | Embedding PostHog-hosted insights via iframe / shared dashboards | Use embeds if you want zero custom UI and no brand control. Rejected: the requirement is a **SweatPact-branded** owner-only dashboard, which embeds can't deliver. |
| `posthog-node` for authoritative events | Capturing everything client-side with `posthog-js` | Pure client capture is fine for UI-only metrics, but financial/pact events must be server-authoritative — client events can be blocked or forged, violating the project's core constraint. |
| PostHog | Plausible / Umami / GA4 / Mixpanel / Amplitude | Plausible/Umami are page-view tools — can't build the onboarding funnel or retention cohorts required. GA4 is sampling-prone and awkward to query server-side. Mixpanel/Amplitude are viable but PostHog's free tier (1M events/mo) + first-party Next.js SDK + queryable HogQL make it the best fit. |
| `date-fns@4` | `dayjs`, Luxon, native `Intl` | Luxon only if you need heavy timezone arithmetic — but `src/lib/time.ts` already owns that. Or skip `date-fns` and extend `time.ts`. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@posthog/nextjs` (`0.0.2`) | Pre-1.0 `0.0.x` package, not the documented integration path; PostHog's official Next.js guide uses `posthog-js` + `posthog-node` directly. | `posthog-js` + `posthog-node` |
| `recharts@2.x` | shadcn `chart` now targets Recharts **v3**; pinning v2 means following an outdated recipe and a future migration. | `recharts@^3.8.1` |
| PostHog personal API key with `NEXT_PUBLIC_` prefix | A leaked Query-Read key exposes all analytics data to the client. | Server-only env var, used only in RSC/route handlers (Node runtime) |
| Querying PostHog from Edge runtime / middleware | Project constraint: admin/service paths require Node runtime; analytics querying should match. | `export const runtime = "nodejs"` on `/admin` server code |
| Broad client **autocapture** left on | Inflates the 1M-event free-tier budget and produces noisy, hard-to-query HogQL. | Capture **named** events for funnel/financial/feature moments |
| Routing money metrics through PostHog events | Analytics is sampling/eventual-consistency tolerant; financial truth must be exact. | Compute ADMIN-04 from **Supabase** with existing clients |
| A generic admin-template UI kit (gray sidebar + metric-card grid) | Explicitly out-of-scope ("corporate SaaS dashboard UX ... zero personality"). | shadcn `chart` + existing brand tokens, custom `/admin` layout |
| Building data exports on the `/query` API | PostHog throttles/breaks export-shaped pipelines. | Aggregate HogQL for dashboards; PostHog batch exports if bulk data is ever needed |

## Stack Patterns by Variant

**If ad-blocker event loss matters (PWA; engaged users may run blockers):**
- Set up a **reverse proxy** via `next.config.mjs` rewrites so PostHog ingestion is same-origin.
- Because client requests to `*.posthog.com` are commonly blocked; same-origin ingestion materially improves capture. Verify the rewrite path doesn't collide with `middleware.ts` exclusions.

**If the admin dashboard only needs fixed time windows for MVP (ADMIN-02…06):**
- Use preset range buttons (7d / 30d / 90d) instead of a calendar.
- Avoids the `react-day-picker` + `date-fns` dependency and ships faster. Add a calendar later only if custom ranges are requested.

**If a metric is a small fixed list vs. a large sortable table:**
- Small/fixed → plain styled `<table>` (no dependency).
- Large/sortable/paginated → shadcn `data-table` (`@tanstack/react-table`).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `posthog-node@^5.38.2` | Node `^20.20.0 \|\| >=22.22.0` | **Action item:** confirm Vercel project + local `.nvmrc`/`engines` target Node 20.20+ or 22.22+. CLAUDE.md cites "Node 18+" — **too low for posthog-node v5**. Either bump the runtime, or pin `posthog-node@^4` (verify v4 capture API before pinning). |
| `recharts@3.8.1` | React `^18.0.0` (also 16/17/19) | Confirmed via peerDependencies; React 18.3.1 supported. No React 19 upgrade needed. |
| shadcn `chart` component | `recharts@3.x` | Generated component expects v3 APIs; do not pin recharts v2. |
| `react-day-picker@^8` | shadcn `calendar` recipe | shadcn's calendar recipe targets v8; v10 exists but adopt only if the generated recipe calls for it. |
| `posthog-js@^1.391.2` | Next.js 14 App Router, React 18 | First-party support; init via `instrumentation-client.ts` or a client `PostHogProvider`. |

## Free Tier / Cost Notes

- **PostHog free tier (resets monthly, no card required):** 1M product-analytics events, 5K session recordings, 1M feature-flag requests, plus error-tracking/survey allotments. Beyond 1M events, usage-based pricing starts ~$0.00005/event and tapers at volume.
- For SweatPact's scale (competitive pairs; ~32 routes; not high-traffic consumer scale), **1M events/month is very likely free**. Keep autocapture off and capture named events to stay well under the cap and keep HogQL clean.

## Sources

- npm registry (`npm view`) — verified 2026-06-20: `posthog-js@1.391.2`, `posthog-node@5.38.2` (engines Node `^20.20.0 || >=22.22.0`), `recharts@3.8.1` (peerDeps React 16–19), `date-fns@4.4.0`, `react-day-picker@10.0.1`/`@8.10.2`, `@tanstack/react-table@8.21.3`, `@posthog/nextjs@0.0.2`. — HIGH
- https://posthog.com/docs/libraries/next-js — App Router setup (posthog-js + posthog-node, `instrumentation-client.ts`, server `PostHogClient` with `flushAt:1`/`flushInterval:0`/`shutdown`, reverse proxy). — HIGH
- https://posthog.com/docs/api/queries — server-side HogQL `/api/projects/:id/query/`, Bearer personal API key (Query Read), 100/50k row limits, not-for-export caveat. — HIGH
- https://ui.shadcn.com/docs/components/chart — shadcn chart built on Recharts **v3**, `npx shadcn@latest add chart`, v2→v3 migration note. — HIGH
- PostHog pricing 2026 (multiple aggregators; cross-checked) — 1M events/mo free tier, usage-based beyond. — MEDIUM (verify exact limits at posthog.com/pricing)

---
*Stack research for: PostHog analytics + custom admin dashboard on Next.js 14 App Router (brownfield)*
*Researched: 2026-06-20*
