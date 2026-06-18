---
phase: 02-step-logic-shared-setup-surfaces
plan: 01
subsystem: onboarding
tags: [vitest, typescript, pure-logic, walkthrough, tour]

# Dependency graph
requires:
  - phase: 01-onboarding-data-foundation
    provides: "STEP_KEY_REGEX, completed_steps semantics, tour_version opaque int (onboarding-progress.ts)"
provides:
  - "Ordered onboarding step registry (STEPS) + TOUR_VERSION constant"
  - "TEACHING_KEYS as single source of truth for the four completion-gating keys"
  - "OnboardingStep / SurfaceId / ProbeId types (uniform registry shape, D-04)"
  - "Pure completion/skip probes: isGymDone, isScheduleDone, isShortcutDone, isTourComplete"
affects: [03-tour-provider, 04-coachmark-engine, 05-sequencing, 06-replay-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure src/lib/onboarding/* module + co-located *.test.ts (clones the Phase-1 onboarding-progress pair)"
    - "Single-source-of-truth constant (TEACHING_KEYS) shared registry->probes to avoid hardcoding the four keys twice"
    - "Frozen registry (Object.freeze) to prevent downstream mutation of shared state"

key-files:
  created:
    - src/lib/onboarding/steps.ts
    - src/lib/onboarding/steps.test.ts
    - src/lib/onboarding/completion.ts
    - src/lib/onboarding/completion.test.ts
  modified: []

key-decisions:
  - "TOUR_VERSION initial value 1, bumped only when the ordered set or identity of STEPS changes (drives Phase 6 replay drift)"
  - "schedule is a setup-bearing registry step but deliberately NOT in TEACHING_KEYS (does not gate completion)"
  - "isScheduleDone derives from rest_days non-empty, never weekly_goal (default 4 is indistinguishable from a deliberate choice)"
  - "isTourComplete reuses TEACHING_KEYS rather than re-hardcoding the four keys (D-01 single source of truth)"

patterns-established:
  - "Completion probes are pure functions over caller-supplied real state (gymCount, restDays, completedSteps); no DB access, no duplicate flag (PROG-02)"
  - "Step ids enforced against the Phase-1 STEP_KEY_REGEX at the registry source so the complete_step contract never breaks"

requirements-completed: [TEACH-06, PROG-02]

# Metrics
duration: 3min
completed: 2026-06-15
---

# Phase 2 Plan 01: Step Logic Modules Summary

**Two pure, DB-free domain modules: an ordered five-step onboarding registry with TOUR_VERSION + TEACHING_KEYS, and four real-state completion/skip probes — fully unit-tested (22 new Vitest cases), no Supabase imports.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-15T14:33:41Z
- **Completed:** 2026-06-15T14:37:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 created

## Accomplishments
- `steps.ts` — frozen ordered registry `[schedule, gym, challenge, money, shortcut_viewed]`, `TOUR_VERSION = 1` with a documented bump rule, `TEACHING_KEYS` (the four gating keys), and the uniform `OnboardingStep`/`SurfaceId`/`ProbeId` types (D-04). Surface/probe attached only to the three setup-bearing steps; `challenge`/`money` are presented-only.
- `completion.ts` — `isGymDone` (gym count), `isScheduleDone` (rest_days non-empty), `isShortcutDone` (`shortcut_viewed` in completed_steps), `isTourComplete` (all four `TEACHING_KEYS` present). All pure, no DB, no duplicate flag.
- 22 new co-located Vitest cases (10 steps + 12 completion); all 42 onboarding-suite tests green. Purity gate clean (zero `@/lib/supabase/*` imports).

## Task Commits

Each task was committed atomically (TDD red → green):

1. **Task 1: Step registry + TOUR_VERSION** — `027339d` (test, RED), `61635df` (feat, GREEN)
2. **Task 2: Completion/skip probes** — `3dbd91a` (test, RED), `9dea1da` (feat, GREEN)

No refactor commits were needed — implementations passed lint and typecheck cleanly on first GREEN.

## Files Created/Modified
- `src/lib/onboarding/steps.ts` - Ordered OnboardingStep registry, TOUR_VERSION, TEACHING_KEYS, SurfaceId/ProbeId types
- `src/lib/onboarding/steps.test.ts` - Registry invariants: id order, STEP_KEY_REGEX conformance, surface/probe distribution, schedule-not-gating, immutability
- `src/lib/onboarding/completion.ts` - Four pure completion/skip probes over real app state
- `src/lib/onboarding/completion.test.ts` - Per-probe coverage incl. the 3-of-4 partial case and extras-don't-block

## Decisions Made
None beyond those pre-specified in the plan (D-01, D-02, D-04 carried from CONTEXT). All implemented as written.

## Deviations from Plan

None - plan executed exactly as written.

One harmless command-syntax adjustment (not a code deviation): the plan's verify command `npm test -- steps.test.ts --pool=threads --run` passes `--pool=threads` twice because the `npm test` script already injects it, which Vitest rejects ("Expected a single value for option --pool"). Dropped the redundant flag (`npm test -- <file> --run`); the package script supplies `--pool=threads`. No source change.

## Issues Encountered
- Git reported `LF will be replaced by CRLF` warnings on commit (Windows line-ending normalization) — cosmetic, no action required.

## User Setup Required
None - no external service configuration required. Both modules are pure logic with no new dependencies (Vitest already installed; no package installs in this plan).

## Next Phase Readiness
- `STEPS` + `TOUR_VERSION` are ready for the Phase 3 TourProvider to drive ordering, and for Phase 6 replay-drift detection.
- `completion.ts` probes are ready for Phase 3+ auto-skip decisions; callers supply `gymCount`/`restDays`/`completedSteps` from their own data fetch (probes stay DB-free).
- Plan 02-02 (shared setup surfaces extraction) is unblocked and independent of these modules.

## Self-Check: PASSED

All four created files and all four task commits (027339d, 61635df, 3dbd91a, 9dea1da) verified present on disk and in git history.

---
*Phase: 02-step-logic-shared-setup-surfaces*
*Completed: 2026-06-15*
