---
phase: 09-admin-dashboard
plan: 02
subsystem: api
tags: [admin-dashboard, metrics, financial, trend-bucketing, posthog, vitest, tdd]

# Dependency graph
requires:
  - phase: 09-admin-dashboard (Plan 01)
    provides: admin route shell + requireOwner gate that hosts these metrics
provides:
  - Pure financial helpers (settlementRate, activePactCount, totalStakesCents) for DASH-01
  - usersWithActivePact helper for DASH-03 user overview
  - Range mapping (rangeToDays, rangeStartDay) for the ?range searchParam (DASH-02)
  - ISO-week trend bucketing (bucketCheckinsByWeek) reusing isoWeekMonday
  - PostHog geo-fail merge seam (mergeGeoFailByWeek) for DASH-02 third series
  - Shared WeekBucket type for the chart (Plan 04) and page (Plan 06)
affects: [09-admin-dashboard Plan 03 (PostHog geo-fail rows), Plan 04 (chart), Plan 06 (RSC page orchestration)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, side-effect-free metrics module — no DB calls, no React, fully unit-tested"
    - "Cross-source merge seam (Supabase buckets + PostHog series) lives in a tested pure helper"
    - "Reuse isoWeekMonday from derived-status — single source of truth for ISO-week math"

key-files:
  created:
    - src/lib/admin-metrics.ts
    - src/lib/admin-metrics.test.ts
  modified: []

key-decisions:
  - "Active pact = a group with >=2 group_members; stake = group.default_penalty_cents (planner resolution of RESEARCH Open Q1, flagged in code for UAT)"
  - "settlementRate denominator = settled + pending; disputed/voided excluded by caller (RESEARCH A5)"
  - "rangeStartDay uses an inclusive window: start = today - (days - 1) so [start, today] spans exactly `days` days"
  - "geoFail is sourced from PostHog only and initialized to 0 by the bucketer, then merged via mergeGeoFailByWeek (Pitfall 1)"

patterns-established:
  - "Pure metrics helpers with co-located *.test.ts following checkin-reconciliation.test.ts structure"
  - "TDD RED (failing test commit) -> GREEN (implementation commit) per task"

requirements-completed: [DASH-01, DASH-02, DASH-03]

# Metrics
duration: 8min
completed: 2026-06-28
status: complete
---

# Phase 09 Plan 02: Admin Metrics Computation Layer Summary

**Pure, fully-tested financial + ISO-week-trend + user-overview helpers (DASH-01/02/03) with a PostHog geo-fail merge seam and a shared WeekBucket type, so the RSC page stays a thin orchestrator.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-28T09:30:27Z
- **Completed:** 2026-06-28T09:38:00Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- DASH-01 financial math: `settlementRate` (divide-by-zero safe), `activePactCount` (>=2 members), `totalStakesCents`
- DASH-03 user overview: `usersWithActivePact` counting distinct users in active pacts
- DASH-02 trend layer: `rangeToDays`, `rangeStartDay` (inclusive window), `bucketCheckinsByWeek` (reuses `isoWeekMonday`), `mergeGeoFailByWeek`
- Shared `WeekBucket` type exported for the chart (Plan 04) and page (Plan 06)
- `formatCents` re-exported from `@/lib/money` for admin display reuse
- 24 unit tests, all passing; `tsc --noEmit` clean

## Task Commits

Each task was committed atomically (TDD test -> feat):

1. **Task 1: Financial + user-overview helpers (DASH-01, DASH-03)**
   - `fe9991a` (test) — failing tests for the four pure helpers
   - `65feb9e` (feat) — implementation; re-export `formatCents`
2. **Task 2: Range + ISO-week trend bucketing (DASH-02)**
   - `3a9b34e` (test) — failing tests for range mapping, bucketing, geo-fail merge
   - `1b5a0f5` (feat) — implementation reusing `isoWeekMonday`; `WeekBucket` type

_TDD tasks have multiple commits (test -> feat). No refactor commits needed — code was clean on first pass._

## Files Created/Modified
- `src/lib/admin-metrics.ts` - Pure financial/trend/user-overview helpers + `WeekBucket` type; re-exports `formatCents`
- `src/lib/admin-metrics.test.ts` - 24 unit tests covering every helper plus zero/empty edge cases

## Decisions Made
- **Active pact definition:** structurally a `groups` row with >=2 `group_members`; stake = the group's `default_penalty_cents`. This is the planner resolution of RESEARCH Open Q1 and is flagged in a code comment so UAT can confirm it matches owner intent.
- **settlementRate denominator:** settled + pending obligation rows; disputed/voided are excluded by the caller (never passed as pending), documented inline per RESEARCH A5.
- **rangeStartDay convention:** inclusive window — start = today - (days - 1) so `[start, today]` spans exactly `days` calendar days; documented in a comment.
- **`admin` source rows:** count toward `total` but increment neither `manual` nor `shortcut` (only those two are the verifiable check-in sources).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Git reported expected LF->CRLF normalization warnings on Windows (cosmetic, no impact).

## Known Stubs
None. All helpers are fully implemented and tested. `mergeGeoFailByWeek` is a forward-looking seam (consumes PostHog geo-fail rows that Plan 03 produces), not a stub — it is fully functional and tested; it simply defaults `geoFail` to 0 until Plan 03 supplies the rows, which is the intended DASH-02 behavior.

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- Plan 04 (chart) can import `WeekBucket` and render `verified`/`unverified`/`geoFail`/`total` series.
- Plan 06 (RSC page) can import all helpers + `formatCents` without re-implementing any math; it supplies `createAdminClient()` rows to the bucketer and Plan 03's PostHog rows to `mergeGeoFailByWeek`.
- No blockers.

## Self-Check: PASSED

All created files exist on disk; all four task commits (fe9991a, 65feb9e, 3a9b34e, 1b5a0f5) are present in git history.

---
*Phase: 09-admin-dashboard*
*Completed: 2026-06-28*
