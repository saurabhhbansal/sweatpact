---
phase: 09-admin-dashboard
plan: 06
subsystem: ui
tags: [nextjs, rsc, supabase, posthog, recharts, admin, zod, dashboard]

# Dependency graph
requires:
  - phase: 09-01
    provides: requireOwner owner gate + parseAdminUserIds
  - phase: 09-02
    provides: admin-metrics pure helpers (financial/trend/user math)
  - phase: 09-03
    provides: admin-posthog HogQL client, query builders, Zod parsers
  - phase: 09-04
    provides: FinancialOverview, CheckinTrendChart, UserOverview, RangeControl components
  - phase: 09-05
    provides: OnboardingFunnel, FeatureAdoption, EngagementPanel + shared EmptyPostHogState
provides:
  - Owner-gated /admin route shell (layout 404s non-owners before any data fetch)
  - Client error boundary for /admin (whole-page error state)
  - force-dynamic RSC dashboard page wiring all 6 panels (DASH-01..06)
  - computeAverageStreak helper (90d Supabase-sourced streak) with tests
affects: [admin-dashboard, analytics, future-admin-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Authorization in the RSC layout (await requireOwner() first) gates data fetch, not middleware"
    - "Service-role admin client reachable only after the owner 404 gate passes"
    - "Source-grouped dashboard: Supabase block over a border-t divider over the PostHog block"
    - "PostHog parser null -> locked empty state; no per-panel try/catch needed"

key-files:
  created:
    - src/app/admin/layout.tsx
    - src/app/admin/error.tsx
    - src/app/admin/page.tsx
  modified:
    - src/lib/admin-metrics.ts
    - src/lib/admin-metrics.test.ts

key-decisions:
  - "WAU omitted (passed null) — dauWau is per-day distinct, no true weekly-distinct PostHog source; refuse to fabricate (mirrors notificationClicks honesty rule)"
  - "Average streak anchored to today: a user with no verified row for today has streak 0 (literal reading of the plan's stepping-back-from-today contract)"
  - "Per-task verification used typecheck + targeted tests; full build/lint/test suite run once at Task 3 (3x full Next builds avoided)"
  - "scalarCount glue helper inlined in page.tsx for the two single-count HogQL results (no parser existed in Plan 03 for scalar shape)"

patterns-established:
  - "Owner-gate-in-layout: await requireOwner() is the first statement so non-owners 404 before the page's createAdminClient() is ever constructed"
  - "Geo-fail merge seam: PostHog geo-fail series merged into Supabase week buckets before the chart renders"

requirements-completed: [ADMIN-01, ADMIN-02, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06]

# Metrics
duration: ~30min
completed: 2026-06-28
status: complete
---

# Phase 09 Plan 06: Admin Dashboard Assembly Summary

**Owner-gated `/admin` route — standalone brand shell that 404s non-owners, a client error boundary, and a force-dynamic RSC that wires all six panels (financial, trend, users, funnel, adoption, engagement) from live Supabase service-role aggregates and cached PostHog HogQL.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-28
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `/admin` is reachable only by owners: `layout.tsx` runs `await requireOwner()` before any markup, so a non-owner gets a 404 and the RLS-bypassing admin client is never constructed for them (ADMIN-01, T-09-14).
- Standalone brand shell with a fixed "SweatPact Admin" header + "Back to app" link and no tab nav / no TourProvider (ADMIN-02).
- RSC dashboard fetches DASH-01/02/03 cross-user aggregates in one `Promise.all`, Zod-validates `?range` (7d/30d/90d, default 30d), and re-throws Next redirect/notFound signals while degrading other failures to an inline Supabase error card.
- DASH-04/05/06 panels render from cached PostHog HogQL (parser-null → locked empty state); geo-fail series merged into the trend chart before render; streak (90d) and churn (14d) computed from Supabase and passed to the EngagementPanel.

## Task Commits

1. **Task 1: Admin layout + error boundary (ADMIN-01/02)** - `b46ec2c` (feat)
2. **Task 2: Dashboard page Supabase block (DASH-01/02/03/06)** - `bbd630d` (feat)
3. **Task 3: PostHog block + grid assembly (DASH-04/05/06)** - `44cacad` (feat)

## Files Created/Modified
- `src/app/admin/layout.tsx` - Owner-gated standalone shell; `requireOwner()` first, fixed header, max-w-5xl container.
- `src/app/admin/error.tsx` - `"use client"` route error boundary with the UI-SPEC whole-page error copy + `reset()`.
- `src/app/admin/page.tsx` - force-dynamic RSC orchestrating all 6 panels; Supabase `Promise.all` + PostHog `Promise.all`, geo-fail merge, Next-signal-safe try/catch.
- `src/lib/admin-metrics.ts` - Added `computeAverageStreak(rows, today)` (DASH-06 streak) + internal `shiftDay` UTC helper.
- `src/lib/admin-metrics.test.ts` - 7 new tests for `computeAverageStreak` (consecutive days, gap stop, no-today=0, multi-user average, dedupe, month boundary).

## Decisions Made
- **WAU omitted (null):** PostHog `dauWau` yields per-day distinct counts, not a true weekly-distinct figure. Rather than fabricate WAU, it is passed `null` (EngagementPanel hides it), consistent with the existing `notificationClicks`-has-no-denominator honesty rule. DAU series/figure, avg streak, and churn still render.
- **Streak anchored to today:** Per the plan's explicit "count consecutive days stepping back from `today`" contract, a user with no verified row for `today` has a streak of 0. Documented in the helper's comment and tests.
- **scalarCount glue:** The notification-click and shortcut-view HogQL queries return a single `[[count]]` row with no Plan 03 parser; a tiny `scalarCount` helper is inlined in `page.tsx` (returns `null` on bad shape → empty state).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] CLAUDE.md-mandated co-located tests for new src/lib helper**
- **Found during:** Task 2 (adding `computeAverageStreak` to `src/lib/admin-metrics.ts`)
- **Issue:** CLAUDE.md requires domain rule changes in `src/lib/*` to update the co-located `*.test.ts`; the plan described the helper inline but did not call out tests.
- **Fix:** Added 7 unit tests for `computeAverageStreak` covering streak counting, gap termination, no-today, multi-user averaging, dedupe, and month-boundary walking.
- **Files modified:** src/lib/admin-metrics.test.ts
- **Verification:** `npm run test` — 224/224 pass (31 in admin-metrics).
- **Committed in:** bbd630d (Task 2 commit)

**2. [Rule 3 - Blocking] Inline scalarCount helper for single-count HogQL results**
- **Found during:** Task 3 (wiring FeatureAdoption notificationClicks/shortcutSetups)
- **Issue:** Plan listed four parsers but the two scalar-count queries (`notificationClickQuery`, `shortcutViewQuery`) return a `[[count]]` shape with no matching parser.
- **Fix:** Added a small `scalarCount(results)` helper in `page.tsx` that returns the numeric scalar or `null` (→ empty state), matching the parser null-contract.
- **Files modified:** src/app/admin/page.tsx
- **Verification:** `npm run typecheck` + `npm run build` succeed; panel renders count or empty state.
- **Committed in:** 44cacad (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical, 1 blocking)
**Impact on plan:** Both within plan intent — tests are a project mandate, scalarCount is required glue for a documented panel prop. No scope creep; no architectural change.

## Issues Encountered
- A duplicate `// --- DASH-03` section header was momentarily introduced when inserting the DASH-06 section into `admin-metrics.ts`; removed immediately before any commit.

## Threat Model Compliance
- **T-09-14 (EoP):** `createAdminClient()` constructed only inside the page, which renders only after the layout's `requireOwner()` 404 gate — verified the gate is the first statement.
- **T-09-15 (Tampering):** `?range` whitelisted via `z.enum([...]).catch("30d")` → `rangeToDays` integer; never interpolated into a query.
- **T-09-16 (Info Disclosure):** try/catch renders fixed copy; `NEXT_REDIRECT`/`NEXT_NOT_FOUND` digests re-thrown; no stack trace surfaced.
- **T-09-17 (Spoofing):** Authorization lives in the RSC layout (not middleware), with `getUser()` revalidation in `requireOwner`.

## User Setup Required
None for this plan's code. Live PostHog panels require `POSTHOG_PROJECT_ID` + `POSTHOG_PERSONAL_API_KEY` (Plan 03); when unset, panels show the locked empty state by design.

## Next Phase Readiness
- All six panels build and render; `/admin` is owner-gated and dynamic.
- Verification suite green: typecheck clean, lint clean (1 pre-existing unrelated warning in `shortcut/client.tsx`), 224/224 tests, production build compiles `/admin` (202 kB First Load JS).
- Remaining for phase UAT (per 09-VALIDATION.md): manual confirmation that a non-owner gets 404 and an owner sees real figures vs empty states.

---
*Phase: 09-admin-dashboard*
*Completed: 2026-06-28*

## Self-Check: PASSED
- All 3 created files + SUMMARY exist on disk.
- All 3 task commits (b46ec2c, bbd630d, 44cacad) present in git history.
