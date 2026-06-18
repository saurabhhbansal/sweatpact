import { STEPS } from "@/lib/onboarding/steps";

/**
 * The render state of a single progress dot relative to the current step:
 * the active step is "current", every step before it is "past", and every
 * step after it (plus the null / unknown-id case) is "future".
 */
export type DotState = "current" | "past" | "future";

/**
 * Pure dot-state derivation for the coachmark progress indicator (D-07).
 *
 * Maps over `STEPS` in registry order and returns one `{ id, state }` entry per
 * step so the dot order matches the step order. No React, no DOM, no side
 * effects — co-located with a `.test.ts` so the project's `.test.ts`-only Vitest
 * config covers it (mirrors the Phase-3 `deriveCurrentStep` precedent).
 *
 * `currentStepId` is resolved against `STEPS`; a `null` or unknown id yields a
 * current index of -1, so every dot reads "future" (the inactive / no-step case)
 * without throwing — a phantom stepId cannot crash the card render (T-04-04).
 *
 * @param currentStepId - the active step id from `useTour().currentStepId`, or null.
 */
export function deriveDotStates(
  currentStepId: string | null
): { id: string; state: DotState }[] {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStepId);

  return STEPS.map((step, index) => {
    let state: DotState;
    if (index === currentIndex) {
      state = "current";
    } else if (currentIndex !== -1 && index < currentIndex) {
      state = "past";
    } else {
      state = "future";
    }
    return { id: step.id, state };
  });
}
