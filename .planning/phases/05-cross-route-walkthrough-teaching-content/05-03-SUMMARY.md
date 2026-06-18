---
phase: 05-cross-route-walkthrough-teaching-content
plan: 03
subsystem: onboarding-walkthrough
status: complete
tags: [onboarding, dashboard, ux, teaching-content, rsc]
requires:
  - "src/lib/onboarding/steps.ts (TEACHING_KEYS)"
  - "src/lib/supabase/rsc.ts (getOnboardingProgress, request-cached)"
  - "src/components/ui/button.tsx (buttonVariants)"
provides:
  - "GettingStartedChecklist — 4-item completion checklist (UX-01)"
  - "EmptyStatePactCTA — no-challenges fallback CTA (UX-02)"
  - "data-tour=gym anchor on the dashboard TodayActionCard wrapper (TEACH-01 reveal target)"
  - "completedSteps + challengeCount reads in the dashboard RSC"
affects:
  - "src/app/(tabs)/dashboard/page.tsx"
tech-stack:
  added: []
  patterns:
    - "RSC reads server-side completed_steps via request-cached getOnboardingProgress(), passes as prop (no client fetch, D-08)"
    - "Self-hiding presentation component keyed off TEACHING_KEYS"
    - "head:true count read appended to existing Promise.all (no extra serial round trip)"
key-files:
  created:
    - "src/components/tour/getting-started-checklist.tsx"
    - "src/components/tour/empty-state-pact-cta.tsx"
  modified:
    - "src/app/(tabs)/dashboard/page.tsx"
decisions:
  - "Open Decision resolved via option 1: dashboard RSC reads completed_steps from the request-cached getOnboardingProgress() and passes completedSteps as a prop — TourValue stays frozen (D-08), no extra client fetch, no extra DB round trip"
  - "challengeCount derived from a group_members head-count for the viewer; empty-state CTA gated on challengeCount === 0"
  - "data-tour=gym anchored on the always-mounted TodayActionCard wrapper (never a conditional element)"
metrics:
  duration: 4min
  completed: 2026-06-18
  tasks: 3
  files: 3
---

# Phase 5 Plan 03: Dashboard Onboarding UX Surfaces Summary

Dashboard onboarding affordances that work even when the coachmark engine is dismissed: a prop-driven 4-item getting-started checklist, a brand-voiced "Start your first pact" empty-state CTA, and the `data-tour="gym"` reveal anchor — all fed by the dashboard RSC reading server-side `completed_steps` with zero extra DB round trip.

## What Was Built

- **`GettingStartedChecklist`** (`src/components/tour/getting-started-checklist.tsx`) — a `"use client"` presentation component over a `completedSteps: string[]` prop. Iterates the imported `TEACHING_KEYS` in order (gym, challenge, money, shortcut_viewed), rendering one row per key with a `--success`-colored `Check` checkmark when the key is complete. Maps each key to its UI-SPEC label via a local `Record<string,string>`. Returns `null` (hides entirely) when all four keys are present. Does NOT consume the tour context / extend `TourValue` (D-08). Reduced-motion handled by reusing the existing `animate-state-in` utility.
- **`EmptyStatePactCTA`** (`src/components/tour/empty-state-pact-cta.tsx`) — a server component (no hooks) mirroring the dashboard "All settled up" card shell. Renders "No stakes yet" heading, consequence-first body ("Your partner is waiting. Put real money on the line."), and a white-variant `buttonVariants` `Link` to `/groups` reading "Start your first pact" with a 44px tap target (`h-11`). No generic/gamified copy.
- **Dashboard RSC wiring** (`src/app/(tabs)/dashboard/page.tsx`) — calls the request-cached `getOnboardingProgress()` (same reader the `(tabs)` layout already invoked → cache hit, no extra round trip), derives `completedSteps` (fallback `[]`), appends a `group_members` head-count `challengeCount` to the existing `Promise.all`, renders the self-hiding checklist as the first child of `<main>` above the daily strip, shows the empty-state CTA when `challengeCount === 0`, and adds `data-tour="gym"` to the always-mounted `TodayActionCard` wrapper. All existing reads, streak math, and the `NEXT_REDIRECT`/`NEXT_NOT_FOUND` re-throw are preserved.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Create GettingStartedChecklist | edbd7c8 |
| 2 | Create EmptyStatePactCTA | 32b02d3 |
| 3 | Wire checklist + CTA + gym anchor into dashboard RSC | fc73544 |

## Verification

- `npx tsc --noEmit -p tsconfig.json` — passes (run after each task).
- `grep -c 'useTour' getting-started-checklist.tsx` → 0 (D-08 honored — TourValue not consumed/extended).
- `grep 'completedSteps: string[]'` → prop-driven signature present; `TEACHING_KEYS` iterated (no hardcoded duplicate key list).
- All four checklist labels and both CTA strings present; `grep -ci 'get started'` → 0 (brand-voice gate).
- Dashboard: `getOnboardingProgress` used (no `fetch('/api/onboarding-progress')` self-fetch → grep 0); `GettingStartedChecklist completedSteps={completedSteps}`, `data-tour="gym"`, and `challengeCount === 0` condition all present; existing `data-tour="schedule"` anchor preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] grep acceptance criteria tripped by explanatory JSDoc comments**
- **Found during:** Tasks 1 and 2
- **Issue:** Acceptance criteria `grep -c 'useTour'` (Task 1, want 0) and `grep -ci 'get started'` (Task 2, want 0) initially failed because the literal tokens appeared inside explanatory JSDoc comments ("the frozen `useTour()` is NOT consumed", "never generic 'Get started' framing"), not in functional code.
- **Fix:** Rephrased both comments to convey the same intent without the literal tokens ("the frozen tour context is NOT consumed"; "never generic/gamified framing"). No behavior change.
- **Files modified:** src/components/tour/getting-started-checklist.tsx, src/components/tour/empty-state-pact-cta.tsx
- **Commits:** edbd7c8, 32b02d3 (fixes folded into the task commits before committing)

## Known Stubs

None. The checklist is driven by real server-read `completed_steps`; the empty-state CTA is gated on a real `group_members` membership count; the gym anchor targets a real always-mounted element. No placeholder data.

## Self-Check: PASSED

- FOUND: src/components/tour/getting-started-checklist.tsx
- FOUND: src/components/tour/empty-state-pact-cta.tsx
- FOUND: src/app/(tabs)/dashboard/page.tsx (modified)
- FOUND commit: edbd7c8
- FOUND commit: 32b02d3
- FOUND commit: fc73544
