import { TEACHING_KEYS } from "@/lib/onboarding/steps";

/**
 * Pure "already done" / "tour complete" probes (D-02, PROG-02).
 *
 * Every probe derives solely from real app state the caller supplies — there is
 * NO duplicate boolean flag and NO DB access here (PROG-02 explicitly forbids a
 * duplicate flag; the caller fetches state and passes it in). These mirror the
 * `mergeProgress` template: pure functions over passed-in state that never
 * mutate their inputs and never import Supabase.
 */

/**
 * Gym set? Source is the `user_gyms` row count — the same `initialGymCount` the
 * gym onboarding already reads (gym/page.tsx:55). True once any gym exists.
 */
export function isGymDone(gymCount: number): boolean {
  return gymCount > 0;
}

/**
 * Weekly goal / schedule set? Signal is `profiles.rest_days` being non-empty —
 * NOT `weekly_goal`. `weekly_goal` defaults to 4, so a default is
 * indistinguishable from a deliberate choice; a fresh profile has empty
 * `rest_days`, so a non-empty array is a reliable "the user edited this" signal.
 * No duplicate flag (PROG-02).
 */
export function isScheduleDone(restDays: number[]): boolean {
  return restDays.length > 0;
}

/**
 * iOS Shortcut viewed? The "viewed" signal lives in the JSONB `completed_steps`
 * array under the semantic key `shortcut_viewed` (Phase-1 D-05) — there is no
 * dedicated column. True once that key is present.
 */
export function isShortcutDone(completedSteps: string[]): boolean {
  return completedSteps.includes("shortcut_viewed");
}

/**
 * Tour complete? True exactly when all four teaching keys are present in
 * `completed_steps` (D-01 / TEACH-06). Re-uses `TEACHING_KEYS` from the registry
 * as the single source of truth — the four keys are never hardcoded twice.
 * A partial set (e.g. 3 of 4) is still incomplete; non-gating extras (e.g.
 * `schedule`) never block completion.
 */
export function isTourComplete(completedSteps: string[]): boolean {
  return TEACHING_KEYS.every((k) => completedSteps.includes(k));
}
