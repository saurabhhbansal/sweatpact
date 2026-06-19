"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ProgressRow } from "@/lib/onboarding-progress";
import { defaultProgress } from "@/lib/onboarding-progress";
import { deriveCurrentStep } from "@/lib/onboarding/current-step";
import { STEPS, TEACHING_KEYS } from "@/lib/onboarding/steps";

// Guard set for advance() — prevents phantom keys from entering optimistic state.
const VALID_IDS = new Set(STEPS.map((s) => s.id));

/**
 * The frozen 4-member context surface for the onboarding walkthrough.
 * Do NOT extend this type in Phase 3 — isComplete, progress, skip, and goTo
 * are deliberately deferred to Phase 4+ after the coachmark library is chosen.
 * UI-SPEC §"Interaction Contract" freezes this shape.
 */
type TourValue = {
  currentStepId: string | null;
  isActive: boolean;
  advance: (stepId: string) => Promise<void>;
  dismiss: () => Promise<void>;
  startReplay: () => Promise<void>;
};

const TourContext = createContext<TourValue | null>(null);

/**
 * Server-hydrated onboarding tour provider. Accepts `initialProgress` read
 * server-side by the (tabs) layout (no-flash guarantee — D-04, RESEARCH Pitfall 2).
 * On null (fetch failure / new user with no row) seeds state from defaultProgress()
 * — the blank-slate path (D-06). Renders {children} directly with no wrapping
 * DOM element so the (tabs) layout flow is unaffected (UI-SPEC Pitfall 5).
 *
 * This component renders NO coachmark, overlay, spotlight, or tooltip — that is
 * Phase 4. It only tracks state and exposes the frozen 4-member contract.
 */
export function TourProvider({
  initialProgress,
  gymCount,
  restDays,
  children,
}: {
  initialProgress: ProgressRow | null;
  gymCount: number;
  restDays: number[];
  children: React.ReactNode;
}) {
  // Seed from the server-hydrated prop; fall back to blank slate (D-06).
  // NO useEffect fetch — that would defeat the no-flash guarantee (D-04).
  const [progress, setProgress] = useState<ProgressRow>(
    initialProgress ?? defaultProgress()
  );

  // Ref so dismiss/startReplay can read current progress without adding it to
  // their useCallback deps (keeps advance/dismiss stable across renders).
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Phase 6 wires real skip-on-complete probe data: gymCount (user_gyms count)
  // and restDays (profiles.rest_days) flow in server-side from the (tabs) layout
  // RSC (D-07: no new client-side fetch). deriveCurrentStep auto-skips steps whose
  // setup work is already done, so the tour opens on the first not-done step with
  // zero flash. completedSteps is not passed in probe — deriveCurrentStep reads it
  // from the first argument directly for the shortcut auto-skip check (WR-04).
  const currentStepId = useMemo(
    () =>
      deriveCurrentStep(progress.completed_steps, progress.dismissed, {
        gymCount,
        restDays,
      }),
    [progress.completed_steps, progress.dismissed, gymCount, restDays]
  );

  /**
   * Mark a step complete. Validates stepId against the STEPS registry before
   * applying any optimistic state — an unknown key is rejected client-side to
   * prevent phantom entries that the server would also reject (400). Optimistically
   * updates local state, then persists via PATCH with only `complete_step` +
   * `last_step_id` (never `completed_steps` — server mergeProgress is authoritative
   * and dedupe-appends, D-04). Best-effort — the walkthrough is an optional surface (D-08).
   *
   * Stable across renders (useCallback + empty deps): setProgress is a stable
   * dispatch, VALID_IDS is a module-level constant. Stability prevents handleAdvance
   * in CoachmarkRenderer from changing on every TourProvider re-render, which would
   * otherwise cause unnecessary surfaceNode remounts (losing form state mid-step).
   */
  const advance = useCallback(async (stepId: string) => {
    if (!VALID_IDS.has(stepId)) {
      console.error("[TourProvider] advance() called with unknown stepId:", stepId);
      return;
    }
    setProgress((p) => ({
      ...p,
      completed_steps: p.completed_steps.includes(stepId)
        ? p.completed_steps
        : [...p.completed_steps, stepId],
      last_step_id: stepId,
    }));
    await fetch("/api/onboarding-progress", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ complete_step: stepId, last_step_id: stepId }),
    }).catch(() => {}); // best-effort — optional surface (D-08)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Dismiss the walkthrough. Optimistic state update makes currentStepId null
   * and isActive false immediately. Persists dismissed:true via PATCH (D-10,
   * ONB-04). Phase 6 adds the Settings reset path.
   *
   * Stable across renders for the same reason as advance (empty deps, stable
   * setProgress dispatch).
   */
  const dismiss = useCallback(async () => {
    const wasCompleted = progressRef.current.completed_at !== null;
    if (wasCompleted) {
      // Skipping mid-replay for an already-completed user: restore "complete"
      // state so the tour doesn't resurface on next open. Setting dismissed=true
      // would break the tour permanently for them.
      const keys = TEACHING_KEYS as string[];
      setProgress((p) => ({
        ...p,
        completed_steps: Array.from(new Set([...p.completed_steps, ...keys])),
        dismissed: false,
      }));
      for (const key of keys) {
        await fetch("/api/onboarding-progress", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ complete_step: key }),
        }).catch(() => {});
      }
    } else {
      setProgress((p) => ({ ...p, dismissed: true }));
      await fetch("/api/onboarding-progress", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resets tour state in-session so replay is immediate without a page reload.
  // Persists replay to server first (non-best-effort); throws on failure so the
  // caller (ReplayTourButton) can show an error. The navigate effect in
  // CoachmarkRenderer detects the step change and routes to the first step.
  const startReplay = useCallback(async () => {
    const res = await fetch("/api/onboarding-progress", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replay: true }),
    });
    if (!res.ok) throw new Error("replay_failed");
    setProgress((p) => ({
      ...p,
      completed_steps: p.completed_steps.filter((k) => !VALID_IDS.has(k)),
      dismissed: false,
      last_step_id: null,
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value: TourValue = {
    currentStepId,
    isActive: currentStepId !== null,
    advance,
    dismiss,
    startReplay,
  };

  // Render {children} directly — no wrapper div/element/padding/margin.
  // The Provider is not a DOM node so the (tabs) layout flow is unaffected
  // (UI-SPEC Pitfall 5).
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

/**
 * Consume the tour context from any component inside TourProvider.
 * Throws when called outside the provider to surface misconfiguration early.
 */
export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
