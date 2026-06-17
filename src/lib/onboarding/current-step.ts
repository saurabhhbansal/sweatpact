import { STEPS } from "@/lib/onboarding/steps";
import { isGymDone, isScheduleDone, isShortcutDone } from "@/lib/onboarding/completion";

/**
 * Pure step-resolution helper (ONB-04 resume/dismiss seam). Returns the id of
 * the first pending, non-skippable walkthrough step, or `null` when the tour
 * is dismissed or all steps are complete/auto-skipped.
 *
 * Inputs are never mutated. No Supabase import, no React, no side effects —
 * mirrors `completion.ts` exactly so this is Vitest-collectable as a `.ts`.
 *
 * @param completedSteps - the `completed_steps` JSONB array from the progress row
 * @param dismissed      - the `dismissed` flag from the progress row (D-10 / ONB-04)
 * @param probe          - real app state for auto-skip derivation (D-09)
 */
export function deriveCurrentStep(
  completedSteps: string[],
  dismissed: boolean,
  probe: { gymCount: number; restDays: number[]; completedSteps: string[] }
): string | null {
  if (dismissed) return null; // D-10 / ONB-04: dismiss short-circuits immediately

  for (const step of STEPS) {
    if (completedSteps.includes(step.id)) continue;
    if (step.probe === "gym" && isGymDone(probe.gymCount)) continue;
    if (step.probe === "schedule" && isScheduleDone(probe.restDays)) continue;
    if (step.probe === "shortcut" && isShortcutDone(probe.completedSteps)) continue;
    return step.id; // first pending, non-skippable step
  }

  return null; // tour complete (all steps done or auto-skipped)
}
