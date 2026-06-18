---
phase: 04-coachmark-engine-single-route
plan: 02
subsystem: ui
tags: [coachmark, onboarding, dot-indicator, presentational-component, tdd]

# Dependency graph
requires:
  - phase: 02-step-logic-shared-setup-surfaces
    provides: STEPS registry (5 ordered steps) that the dot indicator maps over
  - phase: 03-minimal-start-tourprovider-wiring
    provides: deriveCurrentStep pure-helper precedent (pure .ts + co-located .test.ts) mirrored here
provides:
  - "deriveDotStates(currentStepId) pure helper returning per-step current/past/future dot states"
  - "DotState type ('current' | 'past' | 'future')"
  - "CoachmarkCard presentational component (title/body/5-dot row/Next/Skip) for joyride tooltipComponent"
  - "src/components/tour/ directory"
affects: [04-03, coachmark-renderer, joyride-tooltip-component, phase-5-action-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dot-state derivation extracted as a pure .ts module with co-located .test.ts so the project's .test.ts-only Vitest config covers presentation logic without jsdom"
    - "Coachmark card is pure presentation driven entirely by props — zero tour-library/tour-context coupling, so it builds and tests in parallel with the renderer wiring"

key-files:
  created:
    - src/lib/onboarding/coachmark-progress.ts
    - src/lib/onboarding/coachmark-progress.test.ts
    - src/components/tour/coachmark-card.tsx
  modified: []

key-decisions:
  - "deriveDotStates resolves null/unknown stepId to a current index of -1 → all dots 'future', no throw (T-04-04 DoS mitigation)"
  - "Dot row mapped over STEPS in registry order so dot order tracks step order (D-07); dots keyed on step id"
  - "Card reuses the shadcn Button default variant (bg-white text-black) for 'Next →' — no new button re-added (UI-SPEC Registry Safety)"
  - "Card surface is .glass-card (not bg-zinc-900/gray-900) per UI-SPEC override of the CONTEXT zinc candidate; cyan --c-action not used"
  - "Card enter animation uses animate-fade-up so the globals.css prefers-reduced-motion block auto-disables it (TOUR-04)"
  - "Skip tour rendered as a real <button> styled as a muted link (D-06), both controls 44px tap targets, no focus trap"

patterns-established:
  - "Presentation logic that must be unit-tested under a .test.ts-only Vitest config is extracted to a pure .ts helper rather than asserted via a component test"
  - "Bespoke overlay components consume design tokens (.glass-card, Button variants, animate utilities) only — no new gray/accent introduced"

requirements-completed: [TOUR-04]

# Metrics
duration: 3min
completed: 2026-06-18
status: complete
---

# Phase 4 Plan 02: Coachmark Card Shell and Dot Logic Summary

**The 5-dot progress derivation was extracted into a pure, fully unit-tested `deriveDotStates` module (RED→GREEN TDD), and `CoachmarkCard` renders the locked UI-SPEC shell — 16px semibold title, 14px body, 5-dot indicator, white "Next →" button, muted "Skip tour" link — from props using only existing design tokens, with zero react-joyride or tour-context coupling.**

## Performance

- **Duration:** ~3 min
- **Tasks:** 2 (Task 1 TDD: RED + GREEN commits; Task 2: component)
- **Files created:** 3
- **Files modified:** 0

## What Was Built

### Task 1 — `deriveDotStates` pure logic (TDD)

- **`src/lib/onboarding/coachmark-progress.test.ts`** (RED commit `70a4b4e`): 7 Vitest cases covering the mid-step (`challenge` → `[past,past,current,future,future]`), first-step, last-step, `null`, and unknown-id splits, plus `length === STEPS.length` and per-entry step id assertions. Confirmed failing (module absent) before implementation.
- **`src/lib/onboarding/coachmark-progress.ts`** (GREEN commit `c8ecc7b`): exports `type DotState = "current" | "past" | "future"` and `deriveDotStates(currentStepId)`. Finds the current step index in `STEPS`; `null`/unknown resolves to `-1` so every dot reads `"future"` without throwing (T-04-04). Maps `STEPS` in order to `{ id, state }`. Pure — no React, no DOM, no side effects. All 7 tests pass.

### Task 2 — `CoachmarkCard` visual shell

- **`src/components/tour/coachmark-card.tsx`** (commit `337eb8e`): `"use client"`, exports `CoachmarkCard` with props `{ stepId, title, body, onAdvance, onDismiss }`. Renders top→bottom per UI-SPEC §"Card structure (D-05)":
  1. Title — `text-base font-semibold text-white`.
  2. Body — `text-sm font-normal text-white`, `space-y` (`mt-2`).
  3. Dot row — `deriveDotStates(stepId)` → 5 dots, `gap-1` centered; `current=bg-white`, `past=bg-white/40`, `future=bg-white/15`, keyed on id, no "2 of 5" text (D-07).
  4. "Next →" — `Button` default variant, `h-11` (44px), full width, `onClick=onAdvance`.
  5. "Skip tour" — real `<button>` styled as a muted link (`text-[13px] text-white/60 hover:text-white/85`), 44px tap area, `onClick=onDismiss` (D-06).
- Surface uses `.glass-card` on `w-[300px] max-w-[calc(100vw-32px)] mx-4 p-4` with the `animate-fade-up` enter animation (auto-disabled under `prefers-reduced-motion`). No `react-joyride` import, no tour-context call, no `bg-zinc-*`/`bg-gray-9*`/`c-action`.

## Verification

- `npx vitest run src/lib/onboarding/coachmark-progress.test.ts` → 7/7 pass.
- Full suite `npx vitest run` → 130/130 pass (no regression).
- `npx tsc --noEmit` → clean.
- `grep -v '^\s*//' coachmark-card.tsx | grep -c 'bg-zinc-\|bg-gray-9\|c-action'` → 0.
- `grep -c 'react-joyride\|useTour' coachmark-card.tsx` → 0 (literal tokens absent from both code and comments).

## Deviations from Plan

**Minor — comment rewording (not tracked as a deviation rule).** The component's JSDoc originally described what the card does *not* do using the literal strings "react-joyride" and "`useTour()`". While these were prose-only (no import, no call), the plan's acceptance criterion greps for those literals returning 0. The comments were reworded to "imports no tour library and reads no tour context" so the literal-token grep is unambiguously clean. No behavior change.

Otherwise: plan executed exactly as written.

## Known Stubs

None. `title`/`body` are props supplied by the renderer (Plan 03); placeholder *copy* is the renderer's concern per the Copywriting Contract, not a stub in this component.

## Threat Coverage

- **T-04-04 (DoS — unknown stepId):** mitigated. `deriveDotStates(null)` and `deriveDotStates("not_a_step")` return 5 all-`future` entries without throwing — unit-asserted. A phantom stepId cannot crash the card render.
- **T-04-03 (Tampering — title/body):** accepted as planned. Both render as plain React text nodes (auto-escaped); no `dangerouslySetInnerHTML`, no user input.

No new security-relevant surface introduced beyond the plan's threat model.

## Self-Check: PASSED

- FOUND: src/lib/onboarding/coachmark-progress.ts
- FOUND: src/lib/onboarding/coachmark-progress.test.ts
- FOUND: src/components/tour/coachmark-card.tsx
- FOUND commit 70a4b4e (test RED)
- FOUND commit c8ecc7b (feat GREEN)
- FOUND commit 337eb8e (feat CoachmarkCard)

## TDD Gate Compliance

Task 1 followed the RED→GREEN cycle with verified gate commits: `test(04-02)` (`70a4b4e`, confirmed failing before implementation) precedes `feat(04-02)` (`c8ecc7b`, all tests passing). No REFACTOR commit needed — the GREEN implementation was already minimal and clean.
