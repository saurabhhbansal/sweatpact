# Roadmap: SweatPact

**Created:** 2026-06-14
**Active milestone:** v1.2 Analytics & Admin Dashboard

## Milestones

- ✅ **v1.0 MVP** — Shipped Baseline (existing app, documented as Milestone 0)
- ✅ **v1.1 Guided Onboarding Walkthrough** — Phases 1-6 (shipped 2026-06-19)
- 🚧 **v1.2 Analytics & Admin Dashboard** — Phases 7-9 (planning)

## Phases

<details>
<summary>✅ v1.1 Guided Onboarding Walkthrough (Phases 1–6) — SHIPPED 2026-06-19</summary>

- [x] **Phase 1: Onboarding Data Foundation** (2/2 plans) — completed 2026-06-15
- [x] **Phase 2: Step Logic & Shared Setup Surfaces** (2/2 plans) — completed 2026-06-15
- [x] **Phase 3: Minimal Start & TourProvider Wiring** (3/3 plans) — completed 2026-06-17
- [x] **Phase 4: Coachmark Engine (single-route)** (3/3 plans) — completed 2026-06-18
- [x] **Phase 5: Cross-Route Walkthrough & Teaching Content** (4/4 plans) — completed 2026-06-18
- [x] **Phase 6: Skip-on-Complete, Replay & Completion Hardening** (4/4 plans) — completed 2026-06-18

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### v1.2 Analytics & Admin Dashboard (Phases 7–10)

- [x] **Phase 7: Analytics Foundation** (4 plans) - Stand up PostHog ingestion (SDK init, identify, typed event catalog, reverse proxy, Node 20.20+ runtime) (completed 2026-06-27)
- [x] **Phase 8: Event Instrumentation** (5/5 plans) - Capture onboarding, check-in, pact, financial, and feature-usage events across server and client (completed 2026-06-28)
- [ ] **Phase 9: Admin Dashboard** - Owner-gated `/admin` route with branded layout, Supabase-backed financial/check-in/user views, and PostHog-backed funnel/adoption/retention panels

## Phase Details

### Phase 7: Analytics Foundation

**Goal**: PostHog is wired into the app so every event the team writes is reliably ingested, attributed to the right user, and named against one typed catalog.
**Depends on**: Nothing (first phase of v1.2; builds on shipped v1.1 app)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):

  1. A manual `$pageview` event lands in PostHog on every client route change, with autocapture and automatic pageview both disabled (no uncontrolled event noise).
  2. After a user logs in, every event that user triggers is attributed to their Supabase user ID in PostHog (anonymous-to-identified continuity).
  3. All event names used anywhere in the app resolve to constants in `src/lib/analytics/events.ts` following the `category:object_action` convention — no string literals at call sites.
  4. PostHog ingestion traffic is served first-party through `/ingest` (rewrites in place, excluded from middleware, service worker bypasses it) and reaches PostHog without being blocked.
  5. The deployed Vercel runtime is Node.js 20.20+, satisfying the `posthog-node@5` peer dependency so server-side capture works in production.

**Plans**: 4/4 plans complete

- [x] 07-01-PLAN.md — Install posthog-js + posthog-node, set engines.node 20.x, create typed event catalog with tests (FOUND-03, FOUND-05)
- [x] 07-02-PLAN.md — PostHogProvider, PostHogPageview, PostHogIdentity client components (FOUND-01, FOUND-02)
- [x] 07-03-PLAN.md — /ingest reverse proxy rewrites, middleware exclusion, PWA service worker bypass (FOUND-04)
- [x] 07-04-PLAN.md — Wire components into root layout, document env vars, run build + test phase gate (FOUND-01, FOUND-02, FOUND-04)

### Phase 8: Event Instrumentation

**Goal**: Every key product moment — onboarding steps, check-ins, pact lifecycle, financial settlement, and feature usage — emits a typed event, so the dashboard phases have real data to read.
**Depends on**: Phase 7 (catalog, identify, ingestion, and runtime must exist before events are written)
**Requirements**: INSTR-01, INSTR-02, INSTR-03, INSTR-04, INSTR-05
**Success Criteria** (what must be TRUE):

  1. Each onboarding walkthrough step fires a distinct server-side event on its `complete_step` PATCH, so per-step funnel drop-off is measurable (delivers the deferred ANL-01 / ANL-02).
  2. Every check-in emits a server-side event carrying its outcome (verified / unverified / geo-fail) and method (shortcut / manual) as properties.
  3. Pact lifecycle actions — challenge created, invite accepted, invite declined, member left — each emit an event from their existing API route.
  4. Financial events (penalty issued, settlement recorded) are emitted from `cron/enforce` and survive Vercel function teardown via `await posthog.shutdown()` (no lost flush).
  5. Client-side feature-usage events (tab visits, notification CTR, Shortcut setup viewed) fire using the typed constants from `events.ts`.

**Plans**: 5 plans

Plans:

- [x] 08-01-PLAN.md — Create captureServerEvent server helper + unit tests (INSTR-01)
- [x] 08-02-PLAN.md — Instrument onboarding-progress and checkin routes (INSTR-01, INSTR-02)
- [x] 08-03-PLAN.md — Instrument pact lifecycle routes: create, join, respond, leave (INSTR-03)
- [x] 08-04-PLAN.md — Instrument financial routes: enforcement penalties + settlement recorded (INSTR-04)
- [x] 08-05-PLAN.md — Wire client-side feature events: tab visits, notification CTR, shortcut viewed (INSTR-05)

### Phase 9: Admin Dashboard

**Goal**: A SweatPact-owner can open a protected, brand-consistent `/admin` dashboard showing the full picture — financial health from Supabase and product-analytics insight from PostHog — in one place.
**Depends on**: Phase 8 (gate before data exposure; events must be captured before PostHog-backed views)
**Requirements**: ADMIN-01, ADMIN-02, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):

  1. A non-owner who navigates to `/admin` receives a 404; only a session whose Supabase UUID is in `ADMIN_USER_IDS` (revalidated server-side via `getUser()`) can view it.
  2. The `/admin` route renders in its own layout — no tab nav, no TourProvider — using SweatPact brand tokens in a data-dense layout distinct from the tab shell.
  3. The financial overview card shows active pact count, total stakes on the line, total penalties issued, and settlement completion rate, all queried directly from Supabase.
  4. The check-in trend chart shows weekly success count, geo-fail count, and manual-vs-Shortcut split, with selectable 7d / 30d / 90d date ranges.
  5. The user overview shows total registered users, onboarding-completed users, users with an active pact, and users who checked in this week.
  6. The onboarding funnel view shows step-by-step drop-off from PostHog data, cached with `next: { revalidate }` to respect the 120 req/hr Query API limit.
  7. The feature adoption panel shows tab usage, notification CTR, and Shortcut setup rate from PostHog event data.
  8. The engagement & retention panel shows DAU/WAU trend, average streak length, and 14-day churn signal from PostHog + Supabase.

**Plans**: 6 plans

Plans:
**Wave 1**

- [ ] 09-01-PLAN.md — Owner gate: parseAdminUserIds + requireOwner (404, fail-closed) with tests (ADMIN-01)
- [ ] 09-02-PLAN.md — Supabase metrics helpers: settlement rate, active-pact, ISO-week trend buckets, geo-fail merge (DASH-01/02/03)
- [ ] 09-03-PLAN.md — PostHog Query API client + static HogQL builders + Zod parsers + env docs (DASH-04/05/06)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 09-04-PLAN.md — Supabase panel components + recharts: financial, user, range control, trend chart (DASH-01/02/03)
- [ ] 09-05-PLAN.md — PostHog panel components: onboarding funnel, feature adoption, engagement/retention (DASH-04/05/06)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 09-06-PLAN.md — Admin shell (layout + error) + dashboard page integration of all 6 panels (ADMIN-01/02, DASH-01..06)

**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Onboarding Data Foundation | v1.1 | 2/2 | ✅ Complete | 2026-06-15 |
| 2. Step Logic & Shared Setup Surfaces | v1.1 | 2/2 | ✅ Complete | 2026-06-15 |
| 3. Minimal Start & TourProvider Wiring | v1.1 | 3/3 | ✅ Complete | 2026-06-17 |
| 4. Coachmark Engine (single-route) | v1.1 | 3/3 | ✅ Complete | 2026-06-18 |
| 5. Cross-Route Walkthrough & Teaching Content | v1.1 | 4/4 | ✅ Complete | 2026-06-18 |
| 6. Skip-on-Complete, Replay & Completion Hardening | v1.1 | 4/4 | ✅ Complete | 2026-06-18 |
| 7. Analytics Foundation | v1.2 | 4/4 | Complete   | 2026-06-27 |
| 8. Event Instrumentation | v1.2 | 5/5 | ✅ Complete | 2026-06-28 |
| 9. Admin Dashboard | v1.2 | 0/6 | Planned | - |

---
*Roadmap created: 2026-06-14 for milestone v1.1 (Guided Onboarding Walkthrough)*
*v1.1 shipped 2026-06-19 — archived to .planning/milestones/v1.1-ROADMAP.md*
*v1.2 Analytics & Admin Dashboard roadmapped 2026-06-20 — Phases 7–10, 18/18 requirements mapped*
