---
phase: 06-skip-on-complete-replay-completion-hardening
plan: 01
subsystem: onboarding
tags: [react, next-app-router, rsc, supabase, vitest, onboarding-tour]

# Dependency graph
requires:
  - phase: 05-cross-route-walkthrough-teaching-content
    provides: TourProvider with neutral { gymCount: 0, restDays: [] } probe stub; deriveCurrentStep auto-skip logic
  - phase: 02-step-logic-shared-setup-surfaces
    provides: completion.ts probes (isGymDone, isScheduleDone, isShortcutDone) and STEPS registry
provides:
  - Real gymCount + restDays probe data flowing from the (tabs) layout RSC into deriveCurrentStep
  - Auto-skip of already-done setup steps at tour start with zero flash
  - Vitest lock on the combined real-probe no-flash contract
affects: [skip-on-complete-replay-completion-hardening, replay-from-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side probe data: layout RSC computes gymCount/restDays and passes as props (no client fetch)"
    - "Frozen context type honored: component props widened without extending TourValue (D-08)"

key-files:
  created: []
  modified:
    - src/app/(tabs)/layout.tsx
    - src/components/tour-provider.tsx
    - src/lib/onboarding/current-step.test.ts

key-decisions:
  - "Probe data computed server-side in the (tabs) layout RSC and passed as props — no new client-side fetch (D-07)"
  - "TourValue context type left frozen; only TourProvider component props widened (D-08)"
  - "user_gyms count is owner-scoped via .eq(user_id, profile.id) on the request-cached RSC client (T-06-01)"

patterns-established:
  - "RSC-to-client probe channel: layout fetches real app state once and forwards as TourProvider props"
  - "Pure-logic contract lock: Vitest asserts opening step is always the first not-done step, never an auto-skipped one"

requirements-completed: [PROG-03]

# Metrics
duration: 8min
completed: 2026-06-18
status: complete
---

# Phase 6 Plan 01: Skip-on-Complete Probe Wiring Summary

**Real gymCount + restDays flow from the (tabs) layout RSC into deriveCurrentStep so already-done setup steps auto-skip at tour start with zero flash, replacing the Phase 5 neutral stub — Vitest locks the no-flash contract.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-18T18:28Z
- **Completed:** 2026-06-18T18:36Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- (tabs) layout RSC now computes real `gymCount` (owner-scoped `user_gyms` count) and `restDays` (from the already-fetched profile) and passes both into `TourProvider` — no new client-side fetch (D-07)
- `TourProvider` widened with `gymCount` + `restDays` props, forwarding the real probe to `deriveCurrentStep`; the hardcoded `{ gymCount: 0, restDays: [] }` neutral stub is gone and the `useMemo` deps now track both values
- The frozen `TourValue` context type is untouched (D-08) — only component props changed
- Four new Vitest cases lock the combined real-probe no-flash contract: the tour opens on the first not-done step (`challenge` when gym+schedule are probe-done), advances correctly, and returns `null` when fully done

## Task Commits

Each task was committed atomically:

1. **Task 2: Forward real probe to deriveCurrentStep (tour-provider)** - `e1a8e8e` (feat)
2. **Task 1: Fetch real probe in (tabs) layout RSC** - `d573b90` (feat)
3. **Task 3: Lock combined real-probe no-flash contract** - `5c6074b` (test)

_Note: Task 2 (tour-provider) was committed before Task 1 (layout) so each commit typechecks independently — TourProvider must accept the new props before the layout passes them._

## Files Created/Modified
- `src/app/(tabs)/layout.tsx` - Imports `getSupabaseRSC`; queries owner-scoped `user_gyms` for `gymCount`; reads `restDays` off the already-fetched profile; passes both as props to `<TourProvider>`
- `src/components/tour-provider.tsx` - Props widened with `gymCount: number` + `restDays: number[]`; neutral stub replaced with real probe; `useMemo` deps extended; `TourValue` unchanged
- `src/lib/onboarding/current-step.test.ts` - New describe block with `allSetupDoneProbe` fixture and four no-flash-contract cases

## Decisions Made
- None beyond the plan — D-07 (server-side probe, no client fetch) and D-08 (TourValue frozen) followed exactly as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The new Vitest cases passed on first run against the existing `deriveCurrentStep` logic — the function already supported combined-probe auto-skip; this plan supplied real data and locked the contract.

## Known Stubs
None — the Phase 5 neutral probe stub (`gymCount: 0, restDays: []`) was the explicit target of this plan and is now removed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Skip-on-complete is now wired end-to-end with real app state, satisfying the precondition for Plan 02 (replay from Settings): replay keeps `completed_steps` intact and relies on this auto-skip to fast-forward already-done steps (D-04).
- TourValue remains frozen; replay must reactivate via `dismissed: false` without extending the context (D-08).

## Self-Check: PASSED

All modified files exist on disk; all three task commits (`e1a8e8e`, `d573b90`, `5c6074b`) found in git history.

---
*Phase: 06-skip-on-complete-replay-completion-hardening*
*Completed: 2026-06-18*
