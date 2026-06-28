# Pitfalls Research

**Domain:** Adding PostHog analytics + protected owner-only `/admin` dashboard to an existing Next.js 14 App Router + Supabase (RLS) PWA on Vercel
**Researched:** 2026-06-20
**Confidence:** HIGH (PostHog SDK split, query rate limits, Supabase auth gate, Recharts SSR all confirmed against official docs); MEDIUM on PWA/service-worker proxy interaction (inferred from proxy docs + PWA mechanics, not a single authoritative source)

> Scope note: This is a **brownfield** milestone. The biggest risks are not "how do I set up PostHog" — they are how PostHog's client SDK, reverse proxy, and the new `/admin` gate collide with things SweatPact *already has*: a session-refreshing middleware with an explicit `matcher` exclusion list, an existing service worker, server-authoritative RLS, and Vercel serverless functions that get killed the instant a response returns.

## Critical Pitfalls

### Pitfall 1: Server-side events silently dropped because the serverless function exits before flush

**What goes wrong:**
You add `posthog-node` to instrument server events (check-in verified, penalty settled, pact created — exactly the "money" moments that matter most). Events fire in dev (long-lived process) but vanish in production. The funnel/financial numbers in the dashboard are quietly wrong.

**Why it happens:**
`posthog-node` batches and flushes asynchronously. On Vercel, the function is frozen/terminated the moment the route returns its response, before the background flush runs. The official docs are explicit: set `flushAt: 1`, `flushInterval: 0`, and **always `await client.shutdown()`** after capturing in a serverless/request context.

**How to avoid:**
- Create a single `PostHogClient()` factory in `src/lib/posthog/server.ts` returning a client configured with `flushAt: 1, flushInterval: 0`.
- In every server capture site, `await posthog.shutdown()` (or `await posthog.flush()`) before the handler returns.
- Treat server analytics as **best-effort, non-blocking** — wrap in try/catch so a PostHog outage never fails a check-in or settlement (matches SweatPact's existing "silent catch for best-effort operations" convention).

**Warning signs:**
Event counts in PostHog are far lower than DB row counts; events appear locally but not in prod; intermittent missing events under load.

**Phase to address:** Instrumentation phase (server SDK setup) — before any dashboard work, because a broken pipeline makes every downstream metric untrustworthy.

---

### Pitfall 2: `getSession()` used to gate `/admin` — spoofable owner bypass

**What goes wrong:**
The `/admin` gate is built with `supabase.auth.getSession()` (the obvious choice, and what a lot of tutorials still show). The session/user object from `getSession()` is read from cookies and **is not guaranteed to be revalidated** against the auth server, so it can be spoofed. A crafted cookie can present as the owner and the dashboard — exposing every user's financial data, churn, and PII-adjacent funnels — opens up.

**Why it happens:**
`getSession()` is faster and ubiquitous in older examples. Developers assume "I have a session, therefore the user is who they say." Supabase's own guidance is now unambiguous: **never trust `getSession()` in server code for authorization**; use `getUser()` (or `getClaims()`), which round-trips to the Supabase Auth server to revalidate the token every call.

**How to avoid:**
- In the `/admin` layout (server component), call `await supabase.auth.getUser()`, then compare `user.id`/`user.email` to an owner allowlist (env var `ADMIN_USER_IDS` or a DB flag — prefer ID over email, emails can be reassigned/changed).
- On non-owner: `notFound()` (404, don't reveal `/admin` exists) rather than a redirect to a login.
- Gate at the **layout** level so every nested admin page inherits it; do not rely on the page component alone or on middleware alone.
- Defense-in-depth: any admin *data* route should also re-check ownership server-side (don't trust the UI gate). SweatPact already re-implements auth per route — keep that discipline here.

**Warning signs:**
The gate references `getSession()`; the owner check is done only in client code or only in middleware; `/admin` redirects (revealing existence) instead of 404ing.

**Phase to address:** Admin route / auth-gate phase — this is the milestone's single highest-severity security item (ADMIN-01).

---

### Pitfall 3: PostHog reverse proxy collides with the existing middleware matcher and the existing service worker

**What goes wrong:**
The default `us.posthog.com` ingest host is blocked by most ad blockers and privacy browsers, so a chunk of events never arrive. The fix is a same-origin reverse proxy — but bolting one onto SweatPact mishandles **two existing systems**:
1. SweatPact's `middleware.ts` runs on every request with an explicit `matcher` that *excludes* `api/checkin`, `api/cron`, and static assets. A new proxy path (e.g. `/ph/*`) either gets unnecessarily run through session-refresh middleware (latency, cookie churn) or, if added via Next rewrites, fights the middleware matcher.
2. SweatPact ships a **service worker (PWA)**. A SW that caches/intercepts fetches can swallow or stale-cache the analytics requests, dropping or replaying events.

**Why it happens:**
Proxy guides are written for greenfield apps with no existing middleware and no SW. Brownfield integration is left as an exercise.

**How to avoid:**
- Pick a **non-obvious proxy path** — not `/analytics`, `/tracking`, `/telemetry`, `/posthog` (blockers pattern-match these). Use something app-specific (e.g. `/sp-ingest/*`).
- Add the proxy path to the middleware `matcher` **exclusion** list, exactly as `api/checkin`/`api/cron` are excluded — the proxy must not run session-refresh logic.
- Explicitly **exclude the proxy path and PostHog asset requests from service-worker caching** (network-only / SW `fetch` handler bypass). Verify with the SW registered.
- Set `posthog.init({ api_host: '/sp-ingest', ui_host: 'https://us.posthog.com' })` so links in the toolbar still work.

**Warning signs:**
Events drop only for users with ad blockers; events drop only for installed-PWA users (SW active) but work in a fresh browser tab; the proxy path appears in middleware logs.

**Phase to address:** Instrumentation phase (proxy + client SDK). Must be tested against the *installed PWA*, not just a desktop tab.

---

### Pitfall 4: Admin dashboard exhausts the PostHog Query API 120-requests/hour limit (and is slow)

**What goes wrong:**
Each dashboard panel (onboarding funnel, check-in rate, retention, feature adoption) issues its own HogQL query from a server component on every page load. The Query API (`/api/project/:id/query`) is rate-limited to **120 requests/hour** when authenticated with a personal API key. With ~6 panels, ~20 admin page loads/hour blows the budget; panels start 429ing. On top of that, each query round-trips over the network with serverless cold-start latency, so the dashboard feels slow and can hit function timeouts.

**Why it happens:**
Developers treat PostHog like a local DB and query it live per render. The 120/hr limit is easy to miss; it's per personal API key, and dashboards multiply requests.

**How to avoid:**
- **Cache aggressively.** Wrap server queries in Next.js `unstable_cache` / `fetch` with `revalidate` (e.g. 1 hour) or a Vercel Cron job that snapshots metrics into a Supabase table the dashboard reads from. PostHog responses are cached by default (`is_cached`) but that doesn't exempt you from the request-count limit — you must cache on *your* side.
- Batch where possible; don't fire one request per chart on every render.
- Keep the personal API key (with `Query Read` scope) server-only; never expose it to the client.
- For early scale (<50 users) a nightly/hourly Cron snapshot into Postgres is simpler, faster, and rate-limit-proof than live querying — and reuses SweatPact's existing Vercel Cron pattern.

**Warning signs:**
Intermittent 429s on the dashboard; dashboard load times of several seconds; metrics that only update when you hard-refresh repeatedly until a panel succeeds.

**Phase to address:** Dashboard-data phase (ADMIN-02..06). Decide live-query-with-cache vs. Cron-snapshot up front — it shapes the whole data layer.

---

### Pitfall 5: Double initialization / duplicate pageviews from the client SDK

**What goes wrong:**
PostHog gets initialized more than once (e.g. both in a provider and in `instrumentation-client`, or re-init on every render under React 18 StrictMode double-mount), producing duplicate events and inflated counts. Separately, App Router does **not** reliably auto-capture pageviews on client-side (SPA) navigations, so either pageviews are missing or — once you add manual capture — they fire twice.

**Why it happens:**
The recommended init point changed across PostHog versions (provider vs. `instrumentation-client.ts`). Mixing patterns double-inits. App Router's client navigation doesn't trigger full page loads, so default pageview capture misses route changes unless you add a `PostHogPageView` component.

**How to avoid:**
- Initialize **once** via `instrumentation-client.ts` at the app root (current recommended pattern); don't also init in a provider.
- Disable automatic pageview capture (`capture_pageview: false`) and add a single `PostHogPageView` client component using `usePathname()` + `useSearchParams()`. **Wrap it in `<Suspense>`** — `useSearchParams()` without a Suspense boundary forces the whole route to client-render / can break the build.
- Guard against StrictMode double-init with an init flag or by relying on the instrumentation-client single-load.

**Warning signs:**
Pageview/event counts roughly 2× expected; route changes within the app don't show as pageviews; build warning/error about `useSearchParams()` needing Suspense.

**Phase to address:** Instrumentation phase (client SDK).

---

### Pitfall 6: Recharts renders blank (width/height 0) or causes hydration mismatch in App Router

**What goes wrong:**
Charts render blank with console warnings like `width(0) and height(0)... should be greater than 0`, or there's a hydration mismatch error, or the build fails because a Recharts component leaked into a server component.

**Why it happens:**
Recharts is client-only and must be under `"use client"` — it cannot render in an RSC. `ResponsiveContainer` measures its parent on mount; if the parent has no resolved height (common under Suspense, dynamic import, or a flex/grid cell before layout settles) it computes 0×0. SSR of Recharts can also produce server/client markup drift.

**How to avoid:**
- Put all chart components behind `"use client"`; give every chart wrapper an **explicit height** (`height={300}`), not `height="50%"` on an unsized parent.
- Use `<ResponsiveContainer width="100%" height={300}>` with a parent that has a real height.
- Where SSR causes hydration drift, load the chart via `next/dynamic(() => import(...), { ssr: false })` with a sized skeleton fallback (also keeps the heavy charting JS out of the server bundle).

**Warning signs:**
`width(0) and height(0)` warnings; charts appear only after a window resize; hydration mismatch errors mentioning chart DOM; charting code imported into a `page.tsx` without `"use client"`.

**Phase to address:** Dashboard-UI phase (chart rendering).

---

### Pitfall 7: Event-schema rot — events that become meaningless as the product evolves

**What goes wrong:**
Events are named loosely (`button_clicked`, `checkin`) with ad-hoc, inconsistent properties. Six weeks later nobody knows whether `checkin` means "attempted," "geo-verified," or "manual," `snake_case` and `camelCase` props coexist, and the onboarding funnel (the whole point of ANL-01/ANL-02) can't be reconstructed because step names drifted between releases.

**Why it happens:**
Events get added inline at call sites with no central contract; property naming isn't enforced; nobody owns the taxonomy; product changes (e.g. the v1.1 walkthrough rewrite) rename or remove steps without versioning the events.

**How to avoid:**
- Define a **typed event catalog** in one module (e.g. `src/lib/analytics/events.ts`): `object_action` naming (`pact_created`, `checkin_verified`, `walkthrough_step_completed`), a fixed property schema per event, and a single `capture()` wrapper so no raw strings appear at call sites. Fits SweatPact's "named exports, pure `src/lib` modules" convention and is Vitest-testable.
- Tie funnel steps to **REQ-IDs** (ANL-02 already asks for this) so step identity survives copy/UX changes.
- Establish naming conventions before instrumenting (snake_case to match the codebase's DB field style), and a deprecation rule: never silently repurpose an event name — version it (`walkthrough_v2_step_completed`) or add a `version` property.

**Warning signs:**
Two events for the "same" thing; mixed casing in property keys; funnels that break whenever copy changes; analysts asking "what does this event mean?"

**Phase to address:** Instrumentation phase — the catalog must exist *before* events are sprinkled across 32 routes and the walkthrough.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Live-query PostHog from server components per render (no caching) | Fastest to build; always "fresh" | 429s at 120/hr, slow dashboard, cold-start timeouts | Only behind a cache/`revalidate`; never raw |
| `capture()` with raw string event names inline at call sites | One line per event | Schema rot, no type safety, funnels break (Pitfall 7) | Never for the core funnel/financial events |
| Owner allowlist by email instead of user ID | Easy to read/edit | Emails change/reassign → silent privilege drift | Acceptable only with magic-link + verified, ID preferred |
| Skip the reverse proxy, ingest to `us.posthog.com` directly | No proxy/SW/middleware work | Ad-blocker + privacy-browser users invisible (skewed metrics) | Acceptable only if you accept blind spots and document it |
| Fire-and-forget server events without `await shutdown()` | No latency added | Events dropped on Vercel (Pitfall 1) | Never on serverless |
| Recharts SSR on (no `ssr:false`) | Slightly faster first paint | Hydration mismatches, blank charts | OK only when parent height is fixed and no drift observed |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `posthog-node` on Vercel | Capture without flush/shutdown | `flushAt:1, flushInterval:0`, `await shutdown()` per request |
| `posthog-js` in App Router | Init twice; rely on auto-pageviews | Single `instrumentation-client.ts`; manual `PostHogPageView` in `<Suspense>` |
| Reverse proxy | Obvious path (`/analytics`), runs through middleware, cached by SW | Unique path, excluded from middleware `matcher`, bypassed in service worker |
| PostHog Query API | One live query per panel per load | Server-side cache / Cron snapshot into Supabase; `Query Read` key server-only |
| Supabase auth gate | `getSession()` for authz | `getUser()`/`getClaims()` at admin layout; 404 non-owners |
| Recharts | Imported into RSC / unsized container | `"use client"`, explicit height, optional `next/dynamic ssr:false` |
| PWA service worker | Caches PostHog/proxy requests | Network-only bypass for the ingest path |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-panel live HogQL queries | Slow dashboard, 429s | Cache/`revalidate` or Cron snapshot | ~120 query requests/hour (any panel count × loads) |
| Synchronous server capture blocking the request | Slower check-ins/settlements | Best-effort try/catch, flush off the hot path where possible | Immediately under any real traffic spike |
| Reverse proxy through a function | Extra Vercel function invocations + bandwidth cost | Use edge rewrites where possible; monitor usage | Grows with event volume, not user count |
| Shipping Recharts in every bundle | Large client JS, slow admin load | `next/dynamic` per chart, admin-only route | Noticeable as chart count grows |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `getSession()` gating `/admin` | Spoofed owner → full data + PII exposure | `getUser()` at layout; ID allowlist; 404 non-owners |
| Owner check only in client/UI | Bypass via direct API call | Re-check ownership in every admin data route (server-side) |
| Personal API key (Query Read) leaked to client | Anyone queries all analytics | Server-only env var; never in client bundle or `NEXT_PUBLIC_*` |
| PII / financial detail captured into events | Privacy exposure, PostHog as a data-leak vector | Capture IDs not raw amounts/PII; respect existing server-authoritative boundary |
| `/admin` reachable without RLS-backed data scoping | Owner UI trusts client-supplied filters | Admin queries still go through trusted server paths; reuse privilege-scoped clients |
| Redirect (not 404) on non-owner | Reveals `/admin` exists | `notFound()` for non-owners |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Dashboard shows stale/cached numbers with no "as of" label | Owner mistrusts the data | Show `last updated` timestamp (PostHog `is_cached` / snapshot time) |
| Blank charts during load (Recharts 0×0) | Looks broken | Sized skeleton fallback, explicit chart heights |
| Corporate gray metric-card grid | Violates SweatPact's "no corporate SaaS dashboard" Out-of-Scope rule | SweatPact-branded, consequence-first admin layout (separate from `(tabs)`) |
| Counting dev/staging traffic in metrics | Inflated/garbage funnels | Filter dev traffic (disable capture when not production / use a separate project) |

## "Looks Done But Isn't" Checklist

- [ ] **Server events:** Often missing `await shutdown()` — verify events appear in PostHog *from a Vercel preview deploy*, not just `npm run dev`.
- [ ] **Reverse proxy:** Often untested in the installed PWA — verify events still arrive with the **service worker active** and an ad blocker on.
- [ ] **Admin gate:** Often only checked in the page, not the data routes — verify a non-owner hitting the admin *API* directly gets 403/404.
- [ ] **`getUser()` vs `getSession()`:** Grep the admin gate — verify no `getSession()` is used for authorization.
- [ ] **Pageviews:** Often double or missing — verify exactly one pageview per client navigation and `useSearchParams` is inside `<Suspense>`.
- [ ] **Query budget:** Often unbounded — verify dashboard load issues a *bounded, cached* number of PostHog requests (not N panels × every render).
- [ ] **Dev traffic:** Often counted — verify local/preview events don't pollute the production project.
- [ ] **Event catalog:** Often ad-hoc — verify all events flow through the typed wrapper, none as raw strings.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dropped server events (no flush) | MEDIUM | Add flush/shutdown; backfill from Supabase rows where the source-of-truth exists (DB is authoritative, PostHog is not) |
| `getSession()` admin gate shipped | LOW-MEDIUM | Swap to `getUser()`, rotate any exposed data assumptions, audit access logs |
| Query API 429s | LOW | Introduce caching / Cron snapshot; reduce per-render queries |
| Schema rot | HIGH | Define catalog retroactively, deprecate old events, version new ones; historical funnels may be unrecoverable |
| Ad-blocked event loss (no proxy) | LOW | Add reverse proxy; past loss is unrecoverable but DB rows remain the financial source of truth |
| Recharts blank / hydration | LOW | Add explicit heights / `ssr:false`; isolated to UI |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Server events dropped (flush) | Instrumentation (server SDK) | Events visible from a Vercel preview deploy |
| `getSession()` admin bypass | Admin auth-gate (ADMIN-01) | Non-owner gets 404 on page *and* API; grep shows `getUser()` |
| Proxy × middleware × service worker | Instrumentation (proxy/client) | Events arrive in installed PWA with ad blocker on |
| Query API rate limit / latency | Dashboard data (ADMIN-02..06) | Dashboard load issues bounded, cached request count |
| Double init / duplicate pageviews | Instrumentation (client SDK) | One pageview per navigation; `useSearchParams` in Suspense |
| Recharts blank / hydration | Dashboard UI | Charts render on first load with no 0×0 warning |
| Event-schema rot | Instrumentation (catalog first) | All events via typed wrapper; funnel steps carry REQ-IDs |

## Sources

- PostHog — Next.js library docs (client/server split, `instrumentation-client.ts`, `flushAt:1`/`shutdown()`): https://posthog.com/docs/libraries/next-js — HIGH
- PostHog — Next.js reverse proxy (rewrites + middleware), non-obvious path guidance: https://posthog.com/docs/advanced/proxy/nextjs and https://posthog.com/docs/advanced/proxy/nextjs-middleware — MEDIUM/HIGH
- PostHog — Query API reference and rate limits (120/hr personal API key, `is_cached`): https://posthog.com/docs/api/query , https://posthog.com/docs/endpoints/rate-limits — HIGH
- Supabase — Server-Side Auth for Next.js (`getUser()` vs `getSession()` authorization warning): https://supabase.com/docs/guides/auth/server-side/nextjs — HIGH
- Recharts — ResponsiveContainer 0×0 / Suspense issue: https://github.com/recharts/recharts/issues/2736 ; App Router charting guides — HIGH
- SweatPact project context: `.planning/PROJECT.md` (existing middleware matcher excludes `api/checkin`/`api/cron`; PWA service worker; Vercel Cron; RLS; privilege-scoped Supabase clients) — HIGH

---
*Pitfalls research for: PostHog + protected admin dashboard on a brownfield Next.js 14 App Router + Supabase PWA*
*Researched: 2026-06-20*
