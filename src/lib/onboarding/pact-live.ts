/**
 * Pure suppression predicate for the "Pact is live" completion overlay (UX-03).
 *
 * The overlay is the emotional peak of v1.1: it fires once when the viewer has
 * their first active challenge (D-01 — the trigger is challenge activation, NOT
 * `isTourComplete()`). It is shown exactly once, then suppressed forever via a
 * persisted `pact_live_seen` entry in `completed_steps` (D-03).
 *
 * `PACT_LIVE_SEEN_KEY` satisfies STEP_KEY_REGEX (`/^[a-z0-9_]{1,40}$/`) and is
 * deliberately NOT a teaching key, so writing it never affects
 * `isTourComplete()` or any financial state (T-06-06).
 *
 * This is the only testable seam of the overlay — the React rendering/portal
 * concerns mirror `notifications-overlay.tsx` (no co-located test precedent in
 * the codebase). Keeping the predicate pure lets the gating logic be unit-tested
 * under the existing TS-only (no jsdom) Vitest setup.
 */
export const PACT_LIVE_SEEN_KEY = "pact_live_seen";

/**
 * Returns true only when the full-screen overlay should render:
 *  - the component has mounted client-side (portal guard), AND
 *  - the viewer has at least one active challenge (real money on the line), AND
 *  - the seen-flag has not yet been persisted.
 *
 * Any one false condition suppresses the overlay (returns null at the call site).
 */
export function shouldShowPactLive(args: {
  mounted: boolean;
  hasActiveChallenge: boolean;
  completedSteps: readonly string[];
}): boolean {
  const { mounted, hasActiveChallenge, completedSteps } = args;
  if (!mounted) return false;
  if (!hasActiveChallenge) return false;
  if (completedSteps.includes(PACT_LIVE_SEEN_KEY)) return false;
  return true;
}
