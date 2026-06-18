---
phase: 04-coachmark-engine-single-route
plan: 01
subsystem: ui
tags: [react-joyride, coachmark, onboarding, portal, dom-anchor]

# Dependency graph
requires:
  - phase: 03-tour-provider-and-username-gate
    provides: TourProvider wiring and onboarding_progress runtime state that the coachmark engine drives
provides:
  - react-joyride v3.1 runtime dependency available for import
  - "#tour-root portal target div in the root layout, isolated from the InstallGate/Radix subtree"
  - data-tour="schedule" anchor on the always-mounted dashboard "This week" weekly-goal section
affects: [04-02, 04-03, coachmark-engine, joyride-overlay]

# Tech tracking
tech-stack:
  added: [react-joyride@^3.1.0]
  patterns:
    - "Dedicated #tour-root portal target as InstallGate sibling for overlay isolation from Radix portals"
    - "Static data-tour=\"<step-id>\" DOM hooks on unconditionally-mounted elements as coachmark anchors"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - src/app/layout.tsx
    - src/app/(tabs)/dashboard/page.tsx

key-decisions:
  - "react-joyride pinned via caret ^3.1.0 (vetted 3.1.x line, CONTEXT D-01); installed as standard npm dependency, NOT a shadcn registry add"
  - "#tour-root placed AFTER <InstallGate> inside <body> so the joyride portalElement renders outside the InstallGate/Radix portal subtree (TOUR-02 isolation)"
  - "data-tour value 'schedule' chosen to match the STEPS registry id (src/lib/onboarding/steps.ts) for the weekly-goal surface"

patterns-established:
  - "Portal isolation: overlay engines get a dedicated root-level portal div rather than nesting inside the app's existing portal layers"
  - "Anchor stability: data-tour hooks live only on elements rendered unconditionally (no conditional/Suspense gating) so the spotlight target is never absent"

requirements-completed: [TOUR-01, TOUR-02]

# Metrics
duration: 2min
completed: 2026-06-18
status: complete
---

# Phase 4 Plan 01: Coachmark Engine Foundation Summary

**react-joyride v3.1 installed, a dedicated `#tour-root` portal target added at the root-layout body level isolated from the InstallGate/Radix subtree, and a `data-tour="schedule"` anchor placed on the always-mounted dashboard weekly-goal section — with zero coachmark rendering behavior introduced.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-18T07:44:23Z
- **Completed:** 2026-06-18T07:45:53Z
- **Tasks:** 2 (Task 1 package-legitimacy checkpoint pre-approved by human; Tasks 2–3 executed)
- **Files modified:** 4

## Accomplishments
- react-joyride@^3.1.0 added to `dependencies` and locked in `package-lock.json` (installed version 3.1.0); resolves as an import without TypeScript errors
- Empty `<div id="tour-root" />` portal target added in `src/app/layout.tsx` as a direct sibling of `<InstallGate>`, isolated from the InstallGate/Radix portal hierarchy — the documented `portalElement` target Plan 03 will consume via `document.getElementById("tour-root")`
- `data-tour="schedule"` attribute added to the first dashboard `<section>` (the "This week" `glass-card` card), an unconditionally-mounted element, with className unchanged
- `npx tsc --noEmit` passes with no new type errors

## Task Commits

Each task was committed atomically:

1. **Task 2: Install react-joyride v3.1** - `ed068af` (chore)
2. **Task 3: Add #tour-root portal target and dashboard data-tour anchor** - `6ee59ab` (feat)

_Task 1 (react-joyride package-legitimacy checkpoint) was a `checkpoint:human-verify` gate approved by the human before this execution; it produced no code and no commit._

## Files Created/Modified
- `package.json` - Added `react-joyride@^3.1.0` to dependencies
- `package-lock.json` - Locked react-joyride and its transitive dependency tree (11 packages added)
- `src/app/layout.tsx` - Added empty `<div id="tour-root" />` portal target as an InstallGate sibling inside `<body>`
- `src/app/(tabs)/dashboard/page.tsx` - Added `data-tour="schedule"` to the first returned `<section>` (the "This week" weekly-goal card)

## Decisions Made
None beyond the plan — followed plan as specified. The caret range `^3.1.0`, the post-InstallGate portal placement, and the `schedule` anchor value were all prescribed by the plan and applied exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates
None.

## Issues Encountered
- `npm install react-joyride` reported 7 pre-existing repository-wide vulnerabilities (2 moderate, 5 high) in the broader dependency tree during audit. These are NOT introduced by react-joyride's own tree and are out of scope for this additive install task — logged here, not fixed (scope boundary: only react-joyride and its transitive deps were added).

## Known Stubs
None. The `#tour-root` div is intentionally empty by design (it is a portal target consumed in Plan 03), and the `data-tour` attribute is an inert static DOM hook — neither is a data-bearing stub.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 04-02 and 04-03 are unblocked: the library is present, `#tour-root` exists as the portal target, and a real `data-tour="schedule"` anchor exists on a stable dashboard element to spotlight end-to-end on a single route.
- No blockers introduced.

## Self-Check: PASSED

- `src/app/layout.tsx` contains `id="tour-root"` — FOUND
- `src/app/(tabs)/dashboard/page.tsx` contains `data-tour="schedule"` — FOUND
- `package.json` contains `react-joyride@^3.1.0` — FOUND
- Commit `ed068af` (Task 2) — FOUND
- Commit `6ee59ab` (Task 3) — FOUND
- `npx tsc --noEmit` — exit 0, no new type errors

---
*Phase: 04-coachmark-engine-single-route*
*Completed: 2026-06-18*
