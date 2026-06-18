---
phase: 06-skip-on-complete-replay-completion-hardening
plan: 03
subsystem: onboarding
status: complete
tags: [onboarding, overlay, ux-03, completion-moment, radix-dialog]
requires:
  - "src/lib/onboarding-progress.ts (PatchBody complete_step, STEP_KEY_REGEX)"
  - "src/lib/supabase/rsc.ts (getOnboardingProgress, request-cached)"
  - "src/app/api/onboarding-progress/route.ts (PATCH endpoint)"
  - "src/components/ui/button.tsx (default variant, size lg)"
  - "@radix-ui/react-dialog (already installed)"
provides:
  - "src/components/pact-live-overlay.tsx (PactLiveOverlay client component)"
  - "src/lib/onboarding/pact-live.ts (shouldShowPactLive predicate, PACT_LIVE_SEEN_KEY)"
  - "pact_live_seen cosmetic completed_steps key (NOT a teaching key)"
affects:
  - "src/app/(tabs)/groups/page.tsx (renders overlay)"
tech-stack:
  added: []
  patterns:
    - "Pure suppression predicate extracted to src/lib for TS-only unit testing"
    - "Bespoke full-screen Radix Dialog (Primitive parts) instead of shared centered DialogContent"
    - "Fire-and-forget PATCH with ref-guarded single write"
key-files:
  created:
    - "src/components/pact-live-overlay.tsx"
    - "src/lib/onboarding/pact-live.ts"
    - "src/lib/onboarding/pact-live.test.ts"
  modified:
    - "src/app/(tabs)/groups/page.tsx"
decisions:
  - "Used completed_steps entry (pact_live_seen) over localStorage for cross-device shown-once (D-03 preference)"
  - "Extracted shouldShowPactLive to a pure src/lib helper so the gating logic is unit-tested under the existing TS-only (no jsdom) Vitest setup — React render/portal concerns mirror notifications-overlay.tsx (no co-located test precedent)"
  - "Composed DialogPrimitive parts directly (Root/Portal/Overlay/Content) to get a full-bleed z-[120] takeover with no corner X, per UI-SPEC"
metrics:
  duration: "~33 min"
  completed: "2026-06-18"
  tasks: 2
  files_created: 3
  files_modified: 1
---

# Phase 6 Plan 03: Pact-is-Live Completion Moment Summary

Built the UX-03 "Your pact is live." full-screen overlay — a brand-voiced, consequence-first Radix Dialog at `z-[120]` that fires once on `/groups` when the viewer's first challenge goes active, dismisses forward via a single "Let's go →" CTA, and persists `pact_live_seen` so it never reappears.

## What Was Built

### Task 1 — PactLiveOverlay client component (commit 65b3613)
- `src/lib/onboarding/pact-live.ts` — pure `shouldShowPactLive({ mounted, hasActiveChallenge, completedSteps })` predicate and the `PACT_LIVE_SEEN_KEY` constant. This is the only testable seam; it suppresses the overlay unless the component is mounted, the viewer has an active challenge, and the seen-flag is absent.
- `src/lib/onboarding/pact-live.test.ts` — 7 unit tests covering the key format (satisfies `STEP_KEY_REGEX`) and all suppression branches (pre-mount, no challenge, seen, other steps ignored).
- `src/components/pact-live-overlay.tsx` — `"use client"` component composing `DialogPrimitive.Root/Portal/Overlay/Content` into a full-bleed `fixed inset-0 z-[120]` takeover. Backdrop `bg-black/90 backdrop-blur-xl animate-overlay-in`; content `animate-fade-up`. Headline `Your pact is live.` (`text-3xl sm:text-4xl font-semibold`), body `Real money's on the line now. Show up — or pay up.` (`text-white/70`), a restrained `Lock` glyph, and a single white-fill `Button size="lg"` CTA `Let's go →` in a region padded with `max(env(safe-area-inset-bottom), 1.25rem)`. No corner X. Dismiss (CTA or Escape via `onOpenChange`) fires a ref-guarded fire-and-forget PATCH appending `pact_live_seen`.

### Task 2 — Groups RSC wiring (commit 09d52d2)
- `src/app/(tabs)/groups/page.tsx` imports `PactLiveOverlay` + `getOnboardingProgress`, reads `completedSteps` from the request-cached progress row (no extra DB round trip), and renders `<PactLiveOverlay hasActiveChallenge={activeMemberships.length > 0} completedSteps={completedSteps} />` below `</main>`. Existing `activeMemberships` filter, `data-tour`, and `data-pending-count` are untouched.

## Decisions Made

- **Seen-tracking via `completed_steps`** (`pact_live_seen`) over localStorage — cross-device, reuses the existing PATCH endpoint, and the key is deliberately not a teaching key so it never affects `isTourComplete()` or financial state (T-06-06).
- **Pure predicate in `src/lib`** — keeps the gating logic unit-tested under the existing TS-only Vitest setup (no jsdom/React Testing Library exists in the repo; the analog `notifications-overlay.tsx` has no co-located test). React render/portal behavior follows that established analog rather than introducing new test infrastructure.
- **DialogPrimitive composition** — the shared `DialogContent` is a centered `max-w-lg` card with a built-in X; the UI-SPEC requires a full-bleed takeover with one forward exit, so the primitives were composed directly.

## Deviations from Plan

None — plan executed exactly as written. Task 1 carried `tdd="true"`; the testable logic (the suppression predicate) was extracted to `src/lib/onboarding/pact-live.ts` and covered with a co-located `pact-live.test.ts` (7 tests, all green), consistent with the repo convention that `src/lib/*` rule changes ship with co-located `*.test.ts` and the absence of any React-rendering test harness.

## Verification

- `npx tsc --noEmit` — passes with zero errors across the project.
- `grep` confirms `Your pact is live.`, `pact_live_seen`, and `z-[120]` in `pact-live-overlay.tsx`; `PactLiveOverlay` and `activeMemberships.length > 0` in `groups/page.tsx`.
- No `destructive` token and no corner-X / close button in the overlay (grep count 0 for both).
- `npx eslint` clean on all three new/modified source files.
- `npx vitest run src/lib/onboarding/pact-live.test.ts` — 7/7 passing.

## Known Stubs

None. The overlay is fully wired: `hasActiveChallenge` derives from real `activeMemberships`, `completedSteps` from the live progress row, and dismissal persists via the real PATCH endpoint.

## Self-Check: PASSED

- FOUND: src/components/pact-live-overlay.tsx
- FOUND: src/lib/onboarding/pact-live.ts
- FOUND: src/lib/onboarding/pact-live.test.ts
- FOUND: src/app/(tabs)/groups/page.tsx (modified)
- FOUND commit: 65b3613 (Task 1)
- FOUND commit: 09d52d2 (Task 2)
