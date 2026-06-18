import { STEP_KEY_REGEX } from "@/lib/onboarding-progress";

/**
 * The walkthrough's tour version. Phase 1 persists this as the opaque integer
 * `tour_version` (default 1 in `defaultProgress()`, onboarding-progress.ts:54-63).
 *
 * Bump rule: increment whenever the ordered SET or IDENTITY of `STEPS` changes
 * (a step added, removed, reordered, or its `id` renamed) — NOT for cosmetic
 * title edits. The bump is the signal Phase 6 uses to detect replay drift
 * (PROG-04): a persisted progress row carrying an older `tour_version` is
 * reconciled against the current registry.
 */
export const TOUR_VERSION = 1;

/**
 * Names the shared setup component a step mounts (Plan 02 / Phase 3+). Only the
 * setup-bearing steps carry a `surface`; presented-only teaching steps omit it.
 */
export type SurfaceId = "gym" | "schedule" | "shortcut";

/**
 * Names the `completion.ts` probe a step uses to decide auto-skip ("already
 * done"). Only setup-bearing steps carry a `probe`; presented-only teaching
 * steps omit it.
 */
export type ProbeId = "gym" | "schedule" | "shortcut";

/**
 * A uniform registry entry (D-04). `surface`/`probe` are optional: `challenge`
 * and `money` are presented-only teaching points (no setup action, no auto-skip
 * probe), while `schedule`/`gym`/`shortcut_viewed` carry both a setup surface
 * and a completion probe.
 *
 * `id` MUST satisfy `STEP_KEY_REGEX` (onboarding-progress.ts:9) because step ids
 * feed `complete_step` at the Phase-1 PATCH boundary.
 */
export type OnboardingStep = {
  id: string;
  title: string;
  surface?: SurfaceId;
  probe?: ProbeId;
};

/**
 * The ordered walkthrough registry. Frozen (`as const`) so a downstream caller
 * cannot corrupt the shared array (T-02-01). Every `id` is a lowercase-snake key
 * satisfying `STEP_KEY_REGEX` so it is a legal `complete_step` value.
 *
 * Note: the Shortcut step's id IS its completion-gating key `shortcut_viewed`
 * (Phase-1 D-05); `gym`/`challenge`/`money` ids likewise equal their keys.
 * `schedule` is a setup-bearing step but is NOT a completion-gating teaching key
 * (see TEACHING_KEYS and CONTEXT lines 45-46).
 */
export const STEPS: readonly OnboardingStep[] = Object.freeze([
  { id: "schedule", title: "Set your weekly goal", surface: "schedule", probe: "schedule" },
  { id: "gym", title: "Add your gym", surface: "gym", probe: "gym" },
  { id: "challenge", title: "Start a stakes challenge" },
  { id: "money", title: "How the money works" },
  { id: "shortcut_viewed", title: "iOS Shortcut", surface: "shortcut", probe: "shortcut" },
] as const);

/**
 * The four completion-gating teaching keys (D-01). Single source of truth for
 * the "tour complete" rule — re-used by `completion.ts` `isTourComplete` so the
 * four keys are never hardcoded twice. `schedule` is deliberately absent: it is
 * an optional setup step that does NOT block completion (CONTEXT lines 45-46).
 */
export const TEACHING_KEYS: readonly string[] = ["gym", "challenge", "money", "shortcut_viewed"];

// Compile-time assertion that every step id is a legal complete_step key
// (STEP_KEY_REGEX, imported above — never redefined here). Runtime-asserted by
// steps.test.ts; referenced here to document the contract at the source.
void STEP_KEY_REGEX;
