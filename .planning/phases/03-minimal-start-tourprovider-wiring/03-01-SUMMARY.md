---
phase: 03-minimal-start-tourprovider-wiring
plan: "01"
subsystem: onboarding
tags: [supabase, react-cache, vitest, pure-logic, rsc, onboarding]

# Dependency graph
requires:
  - phase: 01-onboarding-data-foundation
    provides: onboarding_progress table, ProgressRow type, defaultProgress(), PatchBody
  - phase: 02-step-logic-shared-setup-surfaces
    provides: STEPS registry, isGymDone/isScheduleDone/isShortcutDone probes
provides:
  - getOnboardingProgress() — request-cached, owner-scoped admin-client reader in rsc.ts
  - deriveCurrentStep() — pure step-resolution helper (ONB-04 resume/dismiss seam)
  - src/lib/onboarding/current-step.ts + current-step.test.ts
affects:
  - 03-02 (TourProvider consumes getOnboardingProgress and deriveCurrentStep)
  - 03-03 (layout gate uses getOnboardingProgress)
  - phase 04 (coachmarks call useTour which derives from deriveCurrentStep)
  - phase 06 (replay/dismiss hardening reuses deriveCurrentStep as testable seam)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - request-cached admin-client DB read (cache() + getAuthUser() + .eq("user_id", user.id) + .maybeSingle())
    - pure probe-aware step derivation in a .ts module with co-located .test.ts for Vitest collection

key-files:
  created:
    - src/lib/onboarding/current-step.ts
    - src/lib/onboarding/current-step.test.ts
  modified:
    - src/lib/supabase/rsc.ts

key-decisions:
  - "getOnboardingProgress uses admin client with strict .eq(\"user_id\", user.id) filter — the sole access-control boundary post-0029 column lockdown (T-03-IDOR)"
  - "deriveCurrentStep extracted as pure .ts (not inlined in provider .tsx) so ONB-04 resume/dismiss is unit-covered by Vitest"
  - "Test for tour-complete with neutral probe asserts 'schedule' returned (not null) — schedule is setup-bearing and not auto-skippable without non-empty restDays"

patterns-established:
  - "Pure step-resolution: walk STEPS registry in order, skip completed, skip if probe satisfied, return first pending (mirroring completion.ts style)"
  - "Request-cached owner-scoped read: mirror getViewerProfile shape exactly (cache + getAuthUser + createAdminClient + .maybeSingle)"

requirements-completed: [ONB-04]

# Metrics
duration: 2min
completed: 2026-06-17
status: complete
---

# Phase 3 Plan 01: Minimal Start & TourProvider Wiring — Server Primitives Summary

**Request-cached getOnboardingProgress() reader and pure deriveCurrentStep() helper with 14-test Vitest suite covering dismiss, resume, auto-skip, and mutation safety (ONB-04 seam)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-17T16:54:39Z
- **Completed:** 2026-06-17T16:56:49Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- Added `getOnboardingProgress()` to `src/lib/supabase/rsc.ts` — request-cached, admin-client, owner-scoped with `.maybeSingle()`, returns `ProgressRow | null`, mirrors `getViewerProfile` shape exactly
- Created `src/lib/onboarding/current-step.ts` — pure `deriveCurrentStep()` that imports the STEPS registry and completion probes, walking in order and auto-skipping probe-satisfied steps
- Created `src/lib/onboarding/current-step.test.ts` — 14-test Vitest suite (all passing): dismiss short-circuit, fresh-start, resume, tour-complete, auto-skip for gym/schedule/shortcut probes, input mutation safety
- Full test suite stays green: 123 tests across 9 files, no regressions

## Task Commits

1. **Task 1: Add getOnboardingProgress() request-cached reader to rsc.ts** - `574f399` (feat)
2. **Task 2: Create pure deriveCurrentStep() helper + co-located Vitest (ONB-04)** - `d5a8691` (feat)

## Files Created/Modified

- `src/lib/supabase/rsc.ts` — added `getOnboardingProgress()` export with `cache()` wrapper, `ProgressRow | null` return type imported from `@/lib/onboarding-progress`
- `src/lib/onboarding/current-step.ts` — new pure module: `deriveCurrentStep(completedSteps, dismissed, probe)` with STEPS walk + probe-aware auto-skip
- `src/lib/onboarding/current-step.test.ts` — 14 Vitest tests covering all ONB-04 behaviors

## Decisions Made

- Test for "four teaching keys present without schedule" correctly asserts `"schedule"` (not `null`) — schedule is the first step in the registry, is setup-bearing, and has a probe (`isScheduleDone`) that returns false for empty `restDays`. Only when `schedule` is explicitly in `completedSteps` OR `restDays` is non-empty does it skip. This is the correct behavior; the initial test draft was wrong.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion corrected for tour-complete behavior**
- **Found during:** Task 2 (Vitest run)
- **Issue:** Initial test `"returns null when the four teaching keys are present without schedule"` expected `null` but `schedule` is the first registry step and has a non-satisfied probe with neutral probe — function correctly returns `"schedule"`, not `null`
- **Fix:** Changed test to assert `"schedule"` is returned, renamed test description to document the correct behavior
- **Files modified:** `src/lib/onboarding/current-step.test.ts`
- **Verification:** `npx vitest run src/lib/onboarding/current-step.test.ts` — 14/14 pass
- **Committed in:** `d5a8691` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test assertion bug)
**Impact on plan:** Minor test correctness fix. No implementation changes, no scope creep. The implementation is exactly as planned.

## Issues Encountered

None beyond the test assertion correction above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `getOnboardingProgress()` is ready for Plan 02 (layout gate) and Plan 03 (TourProvider) to consume
- `deriveCurrentStep()` is ready for Plan 03 (TourProvider) to call inside `useMemo`
- All type contracts are in place: `ProgressRow | null` return, probe shape documented
- 123/123 tests green — no regressions from Phase 1/2 suites

---
*Phase: 03-minimal-start-tourprovider-wiring*
*Completed: 2026-06-17*
