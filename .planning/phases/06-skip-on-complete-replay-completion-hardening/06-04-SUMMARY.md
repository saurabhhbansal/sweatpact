---
phase: 06-skip-on-complete-replay-completion-hardening
plan: 04
subsystem: onboarding
tags: [cleanup, onboarding, routing, dead-code]
status: complete
requires:
  - "Phase 2 shared setup surfaces (GymSurface/ScheduleSurface/ShortcutSurface) live in src/components/onboarding/"
  - "Phase 3 username mandatory-start route + (tabs) layout gate (ONB-01/D-01)"
provides:
  - "Legacy /onboarding/* wizard chain deleted (gym/schedule/shortcut pages + step-indicator)"
  - "Username route lands the user on /dashboard after save (no wizard re-force)"
affects:
  - "src/app/onboarding/ now contains only the username/ route"
tech-stack:
  added: []
  patterns:
    - "git rm for tracked deletions; rmdir leftover empty route dirs"
    - "stale .next/types route stubs cleared before typecheck (generated, gitignored)"
key-files:
  created: []
  modified:
    - src/app/onboarding/username/client.tsx
    - src/app/onboarding/username/page.tsx
  deleted:
    - src/app/onboarding/gym/page.tsx
    - src/app/onboarding/gym/client.tsx
    - src/app/onboarding/schedule/page.tsx
    - src/app/onboarding/schedule/client.tsx
    - src/app/onboarding/shortcut/page.tsx
    - src/app/onboarding/shortcut/client.tsx
    - src/app/onboarding/step-indicator.tsx
decisions:
  - "Post-save redirect target is /dashboard (D-10/D-01): the (tabs) layout gate only redirects to /onboarding/username for auto-usernames, so once a real username is claimed /dashboard renders cleanly"
  - "Task 3 is a verification-only proof gate — no source change, no separate commit"
metrics:
  duration: 2min
  tasks: 3
  files: 9
  completed: 2026-06-18
---

# Phase 6 Plan 04: Legacy Onboarding Wizard Cleanup Summary

Deleted the dead front-loaded onboarding wizard (gym/schedule/shortcut pages + the orphaned `step-indicator.tsx`) and repaired the two surviving couplings in the kept `/onboarding/username` route so it redirects to `/dashboard` after save and no longer renders the deleted `StepIndicator` — closing Phase 6 success criterion 4 (no path re-forces the old wizard).

## What Was Built

- **Task 1 — Delete wizard pages + step-indicator (commit `cf0a8f1`):** Ran a repo-wide reference audit first, confirming the only surviving importers of the deleted paths were the wizard files themselves (being deleted) and the two kept `username/` files (Task 2 fixes). The `coachmark-renderer.tsx` imports of `GymSurface`/`ScheduleSurface` resolve to `src/components/onboarding/*` (the shared surfaces, NOT the deleted wizard clients) and were left untouched. Deleted 7 files via `git rm` and removed the now-empty `gym/`, `schedule/`, `shortcut/` directories. `src/components/onboarding/` and the username route remain intact.
- **Task 2 — Repair kept username route (commit `32ff838`):** Changed `client.tsx` post-save redirect from the deleted `/onboarding/schedule` to `/dashboard` (kept the surrounding `startTransition` + `router.refresh()` so the tabs layout re-evaluates the gate). Removed the `StepIndicator` import and its JSX render block from `page.tsx` (including the now-purposeless `animate-fade-up-item` wrapper that existed solely to hold it). The `SweatPactSeal` header, `Card`, and `UsernamePicker` render are unchanged, as is the page's own `isAutoUsername` gate.
- **Task 3 — Proof gate (no commit):** Full `npx tsc --noEmit` passes clean (exit 0), `npx vitest run` passes 150/150 tests across 11 files, and `NO_DANGLING_IMPORTS` confirmed. The `onboarding/` directory now contains only `username/`.

## Verification Confirmed `/dashboard` Is Correct

Read `src/app/(tabs)/layout.tsx` to confirm the redirect target: the layout gate redirects to `/onboarding/username` **only** when `isAutoUsername(profile.username)` is true. Once a real username is claimed, `/dashboard` renders without bouncing — so `/dashboard` is the correct, gate-compatible post-save destination (ONB-01/D-01, no wizard chain).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cleared stale `.next/types` route stubs for deleted pages**
- **Found during:** Task 2 typecheck
- **Issue:** After deleting the wizard `page.tsx` files, `npx tsc --noEmit` reported TS2307 "Cannot find module" errors in `.next/types/app/onboarding/{gym,schedule,shortcut}/page.ts` — Next.js's auto-generated route type declarations from a prior build still referenced the deleted source pages.
- **Fix:** Removed the stale generated stubs (`rm -rf .next/types/app/onboarding/{gym,schedule,shortcut}`). `.next` is gitignored (confirmed via `git check-ignore .next`) and these files are regenerated on the next build — no source code referenced any deleted path. After clearing, the full typecheck passes clean.
- **Files modified:** None tracked — only the gitignored `.next/` build cache.
- **Commit:** N/A (gitignored build artifact, not committed).

## Known Stubs

None. No placeholder values, empty data sources, or unwired components were introduced — this plan only deletes dead code and repairs one redirect plus one import.

## Self-Check: PASSED

- Deleted files confirmed absent on disk (DELETED_OK) and shared surfaces + username route confirmed present (KEPT_OK).
- `src/app/onboarding/username/client.tsx` contains `router.push("/dashboard")` and no `onboarding/schedule` reference.
- `src/app/onboarding/username/page.tsx` contains no `step-indicator`/`StepIndicator` reference; still renders `UsernamePicker` + `SweatPactSeal`.
- Commits verified in `git log`: `cf0a8f1` (deletions), `32ff838` (username repair).
- `npx tsc --noEmit` exit 0 (clean); `npx vitest run` 150/150 passed.
