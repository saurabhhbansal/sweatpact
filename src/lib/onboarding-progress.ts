import { z } from "zod";

/**
 * Semantic step keys are lowercase snake/alphanumeric, 1-40 chars.
 * Used for both `complete_step` (the single key appended per PATCH) and
 * `last_step_id`. Keeping it strict prevents arbitrary/oversized client input
 * from leaking into the durable `completed_steps` array (D-04, T-01-06).
 */
export const STEP_KEY_REGEX = /^[a-z0-9_]{1,40}$/;

/**
 * The PATCH body for `/api/onboarding-progress`. `.strict()` rejects unknown
 * fields so a client cannot smuggle extra columns. Clients send at most a
 * single semantic step key per write (`complete_step`) — never a full
 * `completed_steps` array (server-authoritative dedupe, D-04).
 */
export const PatchBody = z
  .object({
    complete_step: z.string().regex(STEP_KEY_REGEX, "step_key_format").optional(),
    last_step_id: z
      .string()
      .regex(STEP_KEY_REGEX, "step_key_format")
      .nullable()
      .optional(),
    mandatory_done: z.boolean().optional(),
    dismissed: z.boolean().optional(),
    completed_at: z.string().datetime().nullable().optional(),
  })
  .strict();

export type PatchInput = z.infer<typeof PatchBody>;

/**
 * The six tracked fields that GET returns and PATCH upserts. Mirrors the live
 * `public.onboarding_progress` columns (minus `user_id`, which the route pins
 * to `auth.user.id`).
 */
export type ProgressRow = {
  mandatory_done: boolean;
  tour_version: number;
  last_step_id: string | null;
  completed_steps: string[];
  dismissed: boolean;
  completed_at: string | null;
};

export type ProgressResponse = ProgressRow;

/**
 * The default-shaped response for the missing-row case (D-01). GET returns this
 * neutral object when the caller has no row yet — never a 404/500 and never
 * another user's data.
 */
export function defaultProgress(): ProgressRow {
  return {
    mandatory_done: false,
    tour_version: 1,
    last_step_id: null,
    completed_steps: [],
    dismissed: false,
    completed_at: null,
  };
}

/**
 * Pure merge: starts from `existing`, dedupe-appends `patch.complete_step` into
 * `completed_steps` (no duplicate if already present — replaying the same key is
 * a no-op), and applies the optional scalar fields only when defined. Returns
 * the row to upsert. This is the only testable seam (route handlers are
 * untested per project convention).
 */
export function mergeProgress(existing: ProgressRow, patch: PatchInput): ProgressRow {
  const completed_steps = [...existing.completed_steps];
  if (patch.complete_step !== undefined && !completed_steps.includes(patch.complete_step)) {
    completed_steps.push(patch.complete_step);
  }

  return {
    mandatory_done:
      patch.mandatory_done !== undefined ? patch.mandatory_done : existing.mandatory_done,
    tour_version: existing.tour_version,
    last_step_id:
      patch.last_step_id !== undefined ? patch.last_step_id : existing.last_step_id,
    completed_steps,
    dismissed: patch.dismissed !== undefined ? patch.dismissed : existing.dismissed,
    completed_at:
      patch.completed_at !== undefined ? patch.completed_at : existing.completed_at,
  };
}
