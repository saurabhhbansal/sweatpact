---
phase: 05-cross-route-walkthrough-teaching-content
plan: 01
subsystem: ui
tags: [onboarding, tour, coachmark, react, typescript, vitest]

# Dependency graph
requires:
  - phase: 04-tour-shell-and-coachmark
    provides: locked CoachmarkCard shell, OnboardingStep type, frozen STEPS registry, TOUR_VERSION, deriveDotStates
  - phase: 01-onboarding-progress
    provides: STEP_KEY_REGEX and complete_step PATCH contract that constrains step ids
provides:
  - "OnboardingStep.route?: string — optional per-step tab route (D-06)"
  - "STEPS populated with D-07 routes (schedule/gym -> /dashboard, challenge/money -> /groups, shortcut_viewed -> /shortcut)"
  - "CoachmarkCardProps.surface?: React.ReactNode — optional embedded setup surface slot"
  - "Bounded-scroll surface slot (max-h-[calc(80vh-8rem)] overflow-y-auto) between body and dots"
  - "Conditional standalone Next button (hidden when surface present) + conditional card width (w-[360px] vs w-[300px])"
affects: [cross-route renderer, CoachmarkRenderer navigate-then-reveal, inline setup surfaces, Plan 04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry-as-config: navigation route is per-step metadata on the frozen STEPS array, read by the renderer at runtime"
    - "Prop-driven surface composition: card hosts an embedded ReactNode without taking a tour-library/context dependency (purity preserved)"

key-files:
  created: []
  modified:
    - src/lib/onboarding/steps.ts
    - src/lib/onboarding/steps.test.ts
    - src/components/tour/coachmark-card.tsx

key-decisions:
  - "TOUR_VERSION stays 1 — adding an optional field does not change the ordered set or identity of step ids, so the bump rule does not fire"
  - "challenge route stays /groups in the registry; the invited-user swap to /notifications is resolved at runtime in the renderer (D-09/D-10), not as a second registry field"
  - "Card widens to w-[360px] only when a surface is present (gym/schedule search inputs need extra width); teaching-only steps keep w-[300px]"

patterns-established:
  - "Surface slot is conditionally rendered ({surface ? (...) : null}) and the standalone Next button is its inverse ({surface ? null : (...)}) — Skip tour is unconditional"

requirements-completed: [TOUR-05, TEACH-01, SETUP-02, UX-04]

# Metrics
duration: 8min
completed: 2026-06-18
status: complete
---

# Phase 5 Plan 01: Cross-route foundation primitives Summary

**Added the `route?: string` field to OnboardingStep with D-07 routes populated for all five steps, and extended the locked CoachmarkCard with an optional bounded-scroll `surface` slot that hides the standalone Next button — the two foundation contracts the cross-route renderer (Plan 04) depends on.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-18T13:13:00Z
- **Completed:** 2026-06-18T13:16:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `OnboardingStep` now carries an optional `route?: string`; all five STEPS populated per D-07 (schedule/gym → `/dashboard`, challenge/money → `/groups`, shortcut_viewed → `/shortcut`)
- TOUR_VERSION held at 1 and the frozen-registry / exact-order / STEP_KEY_REGEX tests all still pass — no replay-drift signal introduced
- `CoachmarkCard` accepts an optional `surface` ReactNode rendered in an 80vh-bounded scroll slot between body and dot row; the standalone "Next →" is hidden when a surface is present, while "Skip tour" always remains
- Card purity preserved — still imports only `Button`, `deriveDotStates`, and `cn` (0 tour-library/context imports)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add route field to OnboardingStep + populate STEPS (TDD)** — `cfdad34` (test, RED) → `21a0c48` (feat, GREEN)
2. **Task 2: Add optional surface slot to CoachmarkCard** — `8f2b41f` (feat)

_Task 1 followed RED→GREEN; no refactor commit was needed (minimal implementation)._

## Files Created/Modified
- `src/lib/onboarding/steps.ts` — added `route?: string` to `OnboardingStep` type with JSDoc; populated `STEPS` with D-07 routes; TOUR_VERSION and all existing values byte-identical
- `src/lib/onboarding/steps.test.ts` — added route-mapping, route-format, and TOUR_VERSION-stability cases
- `src/components/tour/coachmark-card.tsx` — added `surface?: React.ReactNode` prop, bounded-scroll surface slot, conditional Next button, conditional card width

## Decisions Made
- **TOUR_VERSION unchanged (1):** adding an optional field is not an add/remove/reorder/rename, so the bump rule does not fire.
- **challenge stays `/groups` in the registry:** the invited-user `/notifications` variant is resolved at runtime in the renderer (D-09/D-10), not as a second registry route field.
- **Conditional card width:** `w-[360px]` only when a surface is present; teaching-only steps keep `w-[300px]`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Git emitted expected LF→CRLF warnings on Windows checkout (cosmetic, no impact).

## Threat Surface
No new threat surface beyond the plan's `<threat_model>`. The route field is client-only navigation metadata that never reaches the server (the PATCH boundary only consumes step ids, which are unchanged). Registry frozen-ness (T-05-01-01), step-id ↔ STEP_KEY_REGEX (T-05-01-02), and card purity (T-05-01-03) mitigations are all re-asserted green by the existing tests + acceptance greps.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both foundation contracts exist with zero file overlap with Plans 02/03 — the cross-route renderer (Plan 04) can now read each step's `route` for navigate-then-reveal and embed a setup surface into the card.
- No blockers.

## Self-Check: PASSED

All modified files exist on disk; all three task commits (cfdad34, 21a0c48, 8f2b41f) present in git history.

---
*Phase: 05-cross-route-walkthrough-teaching-content*
*Completed: 2026-06-18*
