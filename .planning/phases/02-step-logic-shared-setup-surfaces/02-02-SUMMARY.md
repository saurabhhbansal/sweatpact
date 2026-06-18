---
phase: 02-step-logic-shared-setup-surfaces
plan: 02
subsystem: ui
tags: [react, nextjs, onboarding, component-extraction, supabase]

# Dependency graph
requires:
  - phase: 01-onboarding-data-foundation
    provides: "PATCH /api/onboarding-progress write path (complete_step: shortcut_viewed) the ShortcutSurface drives"
  - phase: 02-step-logic-shared-setup-surfaces (02-01)
    provides: "step registry + completion probes that consume the surfaces' real-state writes"
provides:
  - "Three self-contained, onComplete-driven setup surfaces in src/components/onboarding/ (GymSurface, ScheduleSurface, ShortcutSurface)"
  - "Each surface owns its own fetch+save against the EXISTING endpoints — no new endpoints, no logic fork (SETUP-01)"
  - "Legacy /onboarding/{gym,schedule,shortcut} routes rewired as thin client shells passing onComplete = router.push(next)"
  - "Decoupled write authority: surface writes shortcut_viewed; only the legacy shell writes onboarding_complete (Phase-1 D-05)"
affects: [phase-03-tourprovider, phase-05-walkthrough-teaching-content, phase-06-skip-on-complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onComplete-driven surface: a self-contained client component owns fetch+save and is parameterized only by an injected onComplete callback (+ skip) — navigation lives in the caller"
    - "Write-authority decouple: benign progress write (shortcut_viewed) lives in the reusable surface; the gating flip (onboarding_complete) is confined to the legacy shell"

key-files:
  created:
    - src/components/onboarding/gym-surface.tsx
    - src/components/onboarding/schedule-surface.tsx
    - src/components/onboarding/shortcut-surface.tsx
  modified:
    - src/app/onboarding/gym/client.tsx
    - src/app/onboarding/schedule/client.tsx
    - src/app/onboarding/shortcut/client.tsx

key-decisions:
  - "Surfaces are not dummy presentational shells (D-03 'not dummy') — each keeps its own fetch+save against the existing endpoints so both the legacy wizard and the future walkthrough hit identical save logic"
  - "ShortcutSurface writes complete_step: shortcut_viewed via PATCH /api/onboarding-progress; the onboarding_complete: true flip stays in the legacy shell's onComplete (Phase-1 D-05) so a future walkthrough mount cannot prematurely end onboarding"
  - "page.tsx files left untouched — shells keep their original exported symbols (GymOnboarding/ScheduleForm/FinishOnboardingButtons) and prop shapes"

patterns-established:
  - "Pattern: onComplete-driven shared surface — caller injects navigation/advancement; surface stays route-agnostic and reusable across the legacy wizard and the coachmark walkthrough"
  - "Pattern: split write authority across surface vs shell to keep progress signals reusable while keeping the gating flip caller-controlled"

requirements-completed: [SETUP-01]

# Metrics
duration: ~25min
completed: 2026-06-15
---

# Phase 02 Plan 02: Shared Setup Surfaces Summary

**Extracted the gym/schedule/Shortcut onboarding UIs into three self-contained, `onComplete`-driven surface components and rewired the legacy `/onboarding/*` routes as thin shells — parity-locked, no new endpoints, with the `shortcut_viewed`/`onboarding_complete` write paths decoupled per Phase-1 D-05.**

## Performance

- **Duration:** ~25 min (incl. human parity checkpoint)
- **Started:** 2026-06-15
- **Completed:** 2026-06-15
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 6 (3 created, 3 rewired)

## Accomplishments
- Three new `"use client"` surfaces under `src/components/onboarding/`: `GymSurface`, `ScheduleSurface`, `ShortcutSurface` — each owning its own fetch+save against the existing endpoints (`/api/places/search`, `/api/places/details`, `POST /api/gyms`, `PATCH /api/profile`, `PATCH /api/onboarding-progress`), parameterized only by `onComplete` (+ skip).
- Legacy `/onboarding/{gym,schedule,shortcut}/client.tsx` rewired into thin shells that own `useRouter` and pass `onComplete = router.push(next)`; zero duplicated save logic, zero `page.tsx` edits.
- Decouple invariant landed: the `ShortcutSurface` writes only `complete_step: "shortcut_viewed"`; the legacy `onboarding_complete: true` flip is confined to the Shortcut shell's `onComplete` (Phase-1 D-05) — so a future walkthrough mount cannot prematurely end onboarding.
- Parity confirmed at the human checkpoint: all three rewired routes render and behave identically to the prior legacy routes, and both the `shortcut_viewed` and `onboarding_complete` writes land.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the three shared surfaces** - `fe67e87` (feat) — 3 files, +391 lines
2. **Task 2: Rewire legacy onboarding routes into thin shells** - `950fa74` (refactor) — 3 files, +21 / -355 lines
3. **Task 3: Human parity verification** - checkpoint (no code change), USER APPROVED

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `src/components/onboarding/gym-surface.tsx` - Self-contained gym search/add surface; owns `/api/places/search`, `/api/places/details`, `POST /api/gyms`; skip + Continue both call `onComplete`.
- `src/components/onboarding/schedule-surface.tsx` - Self-contained weekly-goal/rest-days surface; owns `PATCH /api/profile`; saves then calls `onComplete` on success; preserves both `gap-1.5` picker clusters and the `tooMany` guard.
- `src/components/onboarding/shortcut-surface.tsx` - Self-contained Shortcut finish surface; writes `shortcut_viewed` via `PATCH /api/onboarding-progress`; does NOT write `onboarding_complete`.
- `src/app/onboarding/gym/client.tsx` - Thin shell: `GymOnboarding` wraps `GymSurface`, `onComplete = router.push("/onboarding/shortcut")`.
- `src/app/onboarding/schedule/client.tsx` - Thin shell: `ScheduleForm` wraps `ScheduleSurface`, `onComplete = router.push("/onboarding/gym")`.
- `src/app/onboarding/shortcut/client.tsx` - Thin shell: `FinishOnboardingButtons` wraps `ShortcutSurface`; `onComplete` performs `PATCH /api/profile { onboarding_complete: true }` then `router.push("/dashboard") + router.refresh()`.

## Decisions Made
- **Surfaces own their save logic (D-03 "not dummy"):** the same surface the legacy wizard mounts is the one the Phase-3+ walkthrough will mount with `onComplete = advance-the-tour` — both paths hit identical save logic and identical existing endpoints (the SETUP-01 "no logic fork" guarantee).
- **Write-authority decouple (Phase-1 D-05):** `shortcut_viewed` (benign progress key) lives in the reusable surface; `onboarding_complete: true` (the gating flip) is confined to the legacy shell.
- **No `page.tsx` changes:** shells preserved their exported symbols/prop shapes so the page components compile and mount unchanged.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification

Decouple + parity invariants asserted post-execution:
- `shortcut_viewed` in `shortcut-surface.tsx`: 1 occurrence (write path present).
- `onboarding_complete` in `shortcut-surface.tsx` (non-comment): 0 occurrences (surface does NOT write the flip).
- `onboarding_complete` in `shortcut/client.tsx`: 3 occurrences (flip confined to the legacy shell).
- `useRouter` in all three surfaces: 0 (navigation hoisted out).
- `gap-1.5` in `schedule-surface.tsx`: 2 (both picker clusters preserved — UI-SPEC grandfathered spacing).
- `git diff` on the three `page.tsx` files: empty (untouched).
- Human checkpoint (Task 3): APPROVED — all three routes render/behave identically; `shortcut_viewed` + `onboarding_complete` writes both landed.

## Threat Model Compliance
- **T-02-05 (EoP, ShortcutSurface write path):** mitigated — surface writes only `shortcut_viewed`; grep gate confirms 0 `onboarding_complete` writes in the surface.
- **T-02-06 (Tampering, save logic vs endpoints):** mitigated — verbatim extraction; no endpoint added or changed; shells contain no duplicated save logic.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The three `onComplete`-driven surfaces are ready for Phase 3+ to mount inside the `TourProvider`/walkthrough with `onComplete = advance-the-tour`.
- Phase 6 cleanup target noted: the legacy `/onboarding/*` redirect chain still exists; Phase 6 will retire it so no path re-forces the old wizard.

## Self-Check: PASSED

- FOUND: src/components/onboarding/gym-surface.tsx
- FOUND: src/components/onboarding/schedule-surface.tsx
- FOUND: src/components/onboarding/shortcut-surface.tsx
- FOUND: src/app/onboarding/gym/client.tsx
- FOUND: src/app/onboarding/schedule/client.tsx
- FOUND: src/app/onboarding/shortcut/client.tsx
- FOUND commit: fe67e87 (Task 1)
- FOUND commit: 950fa74 (Task 2)

---
*Phase: 02-step-logic-shared-setup-surfaces*
*Completed: 2026-06-15*
