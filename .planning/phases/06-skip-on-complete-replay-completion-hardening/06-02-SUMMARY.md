---
phase: 06-skip-on-complete-replay-completion-hardening
plan: 02
subsystem: onboarding
tags: [react, next-app-router, zod, supabase, vitest, onboarding-tour, settings]

# Dependency graph
requires:
  - phase: 01-onboarding-data-foundation
    provides: PatchBody Zod schema + mergeProgress pure merge seam; PATCH /api/onboarding-progress dedupe-append handler
  - phase: 06-skip-on-complete-replay-completion-hardening
    plan: 01
    provides: real probe data into deriveCurrentStep so replay auto-skips already-done steps
provides:
  - One-way replay signal on PatchBody (replay - z.literal(true).optional())
  - mergeProgress reactivates the tour (dismissed-false) on replay without resetting completed_steps (D-04)
  - Replay app tour ghost control in SettingsForm wired to the existing PATCH endpoint
affects: [replay-from-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Minimal Zod widening: one z.literal(true).optional() field keeps .strict() and every existing caller valid (D-06)"
    - "Replay precedence in pure merge: patch.replay forces dismissed:false, overriding explicit dismissed in the same patch"
    - "Settings ghost-row control reuses the glass-card row + fetch/busy/router.refresh pattern (NotifyToggle/ChangePasswordButton analogs)"

key-files:
  created: []
  modified:
    - src/lib/onboarding-progress.ts
    - src/lib/onboarding-progress.test.ts
    - src/app/(tabs)/settings/client.tsx

decisions:
  - "D-04 honored: replay sets dismissed:false but never touches completed_steps — auto-skip (Plan 01) fast-forwards already-done steps instead of re-teaching them"
  - "D-06 honored: reused the existing PATCH endpoint with a single optional field; no new endpoint, .strict() preserved, existing callers unaffected"
  - "replay is one-way: z.literal(true) rejects false/strings/numbers (T-06-03), so the schema surface widens by exactly one boolean-true field"
  - "Replay control rendered as a quiet ghost glass-card row (not the white accent Button) per UI-SPEC; placed in the setup region directly after the iOS Shortcuts row"
  - "Replay precedence: when both replay and dismissed are present in a patch, replay wins (dismissed:false) — reactivation is unambiguous"

metrics:
  duration: 3min
  completed: 2026-06-19
  tasks: 2
  files: 3

status: complete
---

# Phase 6 Plan 02: Replay From Settings Summary

Replay-the-walkthrough wired end-to-end through the existing onboarding-progress endpoint: a one-way `replay: true` flag on the `.strict()` Zod `PatchBody` drives `mergeProgress` to set `dismissed: false` while leaving `completed_steps` intact, and a quiet ghost "Replay app tour" row in Settings PATCHes that flag then `router.refresh()`es so the layout RSC re-hydrates and the tour reactivates.

## What Was Built

**Task 1 — Schema + merge (TDD):** Added `replay: z.literal(true).optional()` to `PatchBody` (keeps `.strict()`, keeps `PatchInput` inference). Extended `mergeProgress` so `patch.replay === true` forces `dismissed: false` (taking precedence over an explicit `dismissed` in the same patch), while `completed_steps` is untouched (D-04). RED → GREEN verified: 3 new failing tests first, then green after implementation. Six new Vitest assertions cover replay parsing, `replay: false` rejection, composition with `complete_step`, existing-caller compatibility, completed_steps preservation, and opt-in behavior (absence does not reactivate).

**Task 2 — Settings control:** New `ReplayTourButton` inner client component rendered directly after the "iOS Shortcuts" Link row in `SettingsForm`. It is a `glass-card` ghost row (label "Replay app tour", sublabel "Walk through the app again", leading `RotateCcw` lucide icon, `min-h-11` tap target) — deliberately not the white accent `Button`. On click it guards against double-fire with a `busy` state, PATCHes `{ replay: true }` to `/api/onboarding-progress`, disables at `opacity-50` while in-flight, shows the inline error `Couldn't restart the tour. Try again.` (`text-sm text-destructive`) on failure, and on success runs `startTransition(() => router.refresh())`.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx vitest run src/lib/onboarding-progress.test.ts` — 26 passed (23 existing + 3 new test blocks, 6 new assertions). Fully green.
- `npx tsc --noEmit` — exit 0, no new type errors anywhere (including settings/client.tsx and onboarding-progress.ts).
- grep confirms `Replay app tour` and `replay: true` both present in `src/app/(tabs)/settings/client.tsx`.
- `PatchBody` still ends with `.strict()` and rejects `{ replay: false }` (asserted in test).

## TDD Gate Compliance

Task 1 followed RED → GREEN: failing tests committed-intent first (3 failures observed: `replay: true` rejected by `.strict()`, `replay: false` incorrectly accepted, mergeProgress not flipping dismissed), then implementation turned all 26 green. No unexpected passes during RED. Test and implementation committed together as the atomic task unit (`feat(06-02)` commit b2bdefa).

## Known Stubs

None. Both artifacts are fully wired: the schema/merge change is consumed by the existing PATCH handler with no further work, and the Settings control calls the live endpoint.

## Threat Flags

None. No new security surface beyond the planned `replay` field (T-06-03, mitigated by `z.literal(true)` + `.strict()`). No new endpoints, auth paths, file access, or schema changes. No package installs (`RotateCcw` is from already-installed lucide-react).

## Self-Check: PASSED

- FOUND: src/lib/onboarding-progress.ts (replay field + mergeProgress replay logic)
- FOUND: src/lib/onboarding-progress.test.ts (6 new replay assertions)
- FOUND: src/app/(tabs)/settings/client.tsx (ReplayTourButton + RotateCcw import)
- FOUND commit: b2bdefa (feat(06-02): add replay signal to PatchBody + mergeProgress)
- FOUND commit: 3df1eff (feat(06-02): add Replay app tour ghost control to Settings)
