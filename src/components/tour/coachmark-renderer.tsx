"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  Joyride,
  type Props as JoyrideProps,
  type Step,
  type TooltipRenderProps,
} from "react-joyride";
import { CoachmarkCard } from "@/components/tour/coachmark-card";
import { GymSurface } from "@/components/onboarding/gym-surface";
import { ScheduleSurface } from "@/components/onboarding/schedule-surface";
import { STEPS } from "@/lib/onboarding/steps";
import { useTour } from "@/components/tour-provider";
import { cn } from "@/lib/utils";

/** z-index ABOVE InstallGate (z-[100]); see UI-SPEC §Z-index (TOUR-02). */
const COACHMARK_Z_INDEX = 110;

/**
 * Per-step brand-voiced teaching copy (UI-SPEC §Copywriting, lines 103-110).
 * Consequence-first, "stakes not stats" — these replace the terse internal
 * registry titles for the surface-facing card (UX-04). The `challenge` step has
 * a self-starter default and an `invited` variant resolved at render time from
 * the `data-pending-count` DOM read (D-09/D-10).
 */
const STEP_COPY: Record<string, { title: string; body: string }> = {
  schedule: {
    title: "Set your weekly goal",
    body: "How many days a week are you showing up? This is the bar you and your partner are held to.",
  },
  gym: {
    title: "Pick your gym",
    body: "We verify check-ins by location. Set the gym you actually train at — no gym, no proof.",
  },
  challenge: {
    title: "Start a pact",
    body: "Challenge your gym partner with real money on the line. Skip a day you owe — show up and you don't.",
  },
  money: {
    title: "This is the scoreboard that matters",
    body: "Not streaks — money. What you've earned, what you owe, and how it settles every week.",
  },
  shortcut_viewed: {
    title: "Check in from your phone",
    body: "iOS users: one tap via the Shortcut. Everyone else: manual check-in works the same. Try a practice run below — it won't count.",
  },
};

/**
 * Stable null-arrow component. Defined at module scope so joyride receives the
 * same component type identity across re-renders — an inline `() => null` would
 * create a new type every render and cause joyride to remount the arrow slot.
 */
function NullArrow() { return null; }

/** True while any Radix dialog is open (D-04 pause condition). */
function anyDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector('[role="dialog"][data-state="open"]') !== null;
}

/**
 * Resolve a step's route from the registry (D-06). The challenge step always
 * anchors on /groups with the self-starter copy. The former invited-user variant
 * (which swapped to /notifications when a DOM `data-pending-count` read was > 0)
 * was removed: that attribute only exists on /groups, so by the time the step was
 * active on /groups the swap could never fire, and the "accept the pact" invited
 * copy rendered against the wrong anchor.
 */
function stepRoute(stepId: string | null): string | null {
  if (!stepId) return null;
  return STEPS.find((s) => s.id === stepId)?.route ?? null;
}

/** True while focus is inside an editable control — never hijack keys there. */
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
}

/**
 * PracticeCheckIn — the shortcut step's embedded surface (D-05 / TEACH-05).
 *
 * CRITICAL FINANCIAL-SAFETY GUARANTEE: this control is COSMETIC ONLY. Clicking
 * "Practice check-in" runs a brief (≤400ms) success pulse then calls onComplete
 * (which advances the tour). It makes ZERO network calls — it never contacts the
 * real check-in endpoint, issues no fetch, reads no geolocation, and creates no
 * submission. A practice run can never forge a verified check-in or touch stakes,
 * penalties, or stats. The ONLY side effect is the tour advancing; the
 * `shortcut_viewed` completion write happens through TourProvider's existing
 * best-effort onboarding-progress PATCH (NOT a check-in). This component is
 * deliberately co-located in this file so the no-network guarantee is auditable
 * in one place. (Threat T-05-04-CHECKIN.)
 */
function PracticeCheckIn({
  reducedMotion,
  onComplete,
}: {
  reducedMotion: boolean;
  onComplete: () => void;
}) {
  const [simulating, setSimulating] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Cancel the pulse timer on unmount to prevent a double-advance if the step
  // changes before the 400ms fires (WR-01).
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function runPractice() {
    if (simulating) return;
    // Under reduced motion, advance near-instantly with no pulse (TOUR-04).
    if (reducedMotion) {
      onComplete();
      return;
    }
    setSimulating(true);
    // Cosmetic success pulse, capped at 400ms (UI-SPEC §Motion). NO fetch, NO
    // check-in API call — see the safety guarantee above.
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onComplete();
    }, 400);
  }

  return (
    <div className="space-y-2 pt-1">
      <button
        type="button"
        onClick={runPractice}
        disabled={simulating}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition disabled:cursor-default",
          simulating && "animate-pulse bg-emerald-400 text-black"
        )}
      >
        {simulating ? (
          <>
            <span aria-hidden="true">✓</span> Checked in
          </>
        ) : (
          "Practice check-in"
        )}
      </button>
      <p className="text-center text-xs text-white/55">
        Practice only — never counts toward stakes.
      </p>
    </div>
  );
}

/**
 * CoachmarkRenderer — the load-bearing engine. Wires react-joyride v3.1 to the
 * FROZEN Phase-3 useTour() API and renders CoachmarkCard as the spotlight tooltip
 * on the current step's `data-tour` anchor.
 *
 * This is the ONLY file that imports react-joyride (the swap boundary, RESEARCH
 * Architecture). It satisfies all four TOUR requirements on the single dashboard
 * route: anchor-gating (TOUR-01), click-through overlay above z-[100] in
 * #tour-root (TOUR-02), Radix-dialog pause (D-04), safe-area positioning
 * (TOUR-03), and keyboard/focus/aria-live/reduced-motion a11y (TOUR-04).
 *
 * Consumes useTour() UNCHANGED — only currentStepId/isActive/advance/dismiss.
 */
export function CoachmarkRenderer() {
  const { currentStepId, isActive, advance, dismiss } = useTour();

  // --- Cross-route navigation (TOUR-05 / D-06) ---------------------------
  // navigate-then-reveal: on advance the provider recomputes currentStepId to
  // the NEXT step; this effect (below) reads that step's effective route and
  // router.push()es when it differs from the current pathname. The existing
  // anchor-gate observer then reveals once the new page mounts the anchor.
  const router = useRouter();
  const pathname = usePathname();

  // --- Anchor readiness gate (TOUR-01) -----------------------------------
  // Tracks the VERIFIED selector (the one confirmed present in the DOM), not just
  // a boolean. The distinction matters on cross-route transitions: when
  // `selector` changes to the next step, `anchorReady` from the old step would
  // be stale for one render cycle, causing joyride to briefly spotlight a
  // non-existent target. By comparing `verifiedSelector === selector` we only
  // show joyride when the CURRENT selector has been confirmed in the DOM.
  const [verifiedSelector, setVerifiedSelector] = useState<string | null>(null);

  // --- Radix-dialog pause (D-04) -----------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);

  // --- Reduced motion (TOUR-04) ------------------------------------------
  const [reducedMotion, setReducedMotion] = useState(false);

  const selector = currentStepId ? `[data-tour="${currentStepId}"]` : null;

  // Recompute reduced-motion preference, reacting to OS changes.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Gate the spotlight on the anchor being in the DOM. Re-check via a
  // MutationObserver until the target mounts (TOUR-01); never spotlight empty
  // space. Resets whenever the active step changes.
  useEffect(() => {
    if (!isActive || !selector) {
      setVerifiedSelector(null);
      return;
    }
    const check = () =>
      setVerifiedSelector(
        document.querySelector(selector) !== null ? selector : null
      );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isActive, selector]);

  // The set of routes that the tour owns. Navigation is only triggered when the
  // user is already on one of these routes (or on the step's own target route).
  // Intentionally excludes /settings, /u/*, /shortcut, etc. so that the tour
  // never hijacks deliberate user navigation away from the tour flow (Bug 2 fix:
  // opening Settings while the tour is active caused an immediate redirect back).
  const TOUR_ROUTES = useMemo(() => new Set(
    STEPS.map((s) => s.route).filter(Boolean) as string[]
  ), []);

  // Navigate-then-reveal (TOUR-05 / D-06): whenever the active step changes,
  // compute its registry route and push only when it differs from the current
  // pathname (guards against re-render loops, threat T-05-04-03). We do NOT add
  // a second observer — the reused anchor-gate above reveals once the new page's
  // anchor mounts (PATTERNS line 74). `pathname` is intentionally excluded from
  // deps so we navigate exactly once per step change; the closure captures the
  // pathname at the moment the step changes, which is correct.
  //
  // Guard: only redirect when the current pathname is already a tour-owned route.
  // If the user intentionally navigated to /settings or another non-tour page,
  // we leave them there — the tour resumes when they return to a tour route.
  useEffect(() => {
    if (!isActive || !currentStepId) return;
    const target = stepRoute(currentStepId);
    if (target && target !== pathname && TOUR_ROUTES.has(pathname)) {
      router.push(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStepId, router]);

  // Pause while any Radix dialog is open; restore on close (D-04, TOUR-02).
  // Watches data-state changes so it reacts to open/close without re-render churn.
  useEffect(() => {
    if (!isActive) {
      setDialogOpen(false);
      return;
    }
    const update = () => setDialogOpen(anyDialogOpen());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "role"],
    });
    return () => observer.disconnect();
  }, [isActive]);

  const handleAdvance = useCallback(() => {
    if (currentStepId) advance(currentStepId);
  }, [advance, currentStepId]);

  const handleDismiss = useCallback(() => {
    dismiss();
  }, [dismiss]);

  // A step is "showing" only when active, its anchor is confirmed in the DOM for
  // the CURRENT selector, and no Radix dialog is open.
  const showing = isActive && verifiedSelector === selector && !dialogOpen;

  // Keyboard (TOUR-04): Enter/Space = advance, Escape = dismiss. Never hijack
  // keys while focus is in an editable control or a dialog is open. Focus is
  // NOT trapped — this is a window-level handler, the page stays reachable.
  useEffect(() => {
    if (!showing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || anyDialogOpen()) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        // Let a focused button (the card's "Next →"/"Skip tour") handle its own
        // Enter/Space click — only act when focus is elsewhere, to avoid
        // double-firing.
        if (document.activeElement instanceof HTMLButtonElement) return;
        e.preventDefault();
        handleAdvance();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showing, handleAdvance, handleDismiss]);

  // Resolve the brand-voiced per-step copy (UX-04). Prefer STEP_COPY over the
  // terse registry titles; fall back to the registry title for any step missing
  // a copy entry.
  const stepCopy = useMemo(() => {
    if (!currentStepId) return { title: "", body: "" };
    const copy = STEP_COPY[currentStepId];
    if (copy) return copy;
    const step = STEPS.find((s) => s.id === currentStepId);
    return { title: step?.title ?? "", body: "" };
  }, [currentStepId]);
  const stepTitle = stepCopy.title;
  const stepBody = stepCopy.body;

  // Move focus to the card's primary "Next →" button when a step appears
  // (TOUR-04). The card is portaled by joyride into #tour-root; we query its
  // first <button> (the "Next →" CTA renders before "Skip tour") once it lands.
  // Focus is NOT trapped (UI-SPEC) — we only move focus once per appearance.
  useEffect(() => {
    if (!showing) return;
    const root = document.getElementById("tour-root");
    if (!root) return;
    let cancelled = false;
    let attempts = 0;
    const focusPrimary = () => {
      if (cancelled) return;
      const primary = root.querySelector<HTMLButtonElement>("button");
      if (primary) {
        primary.focus();
        return;
      }
      if (attempts++ >= 120) return; // ~2s at 60fps; stop if tooltip never portals
      requestAnimationFrame(focusPrimary);
    };
    const raf = requestAnimationFrame(focusPrimary);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [showing, currentStepId]);

  // Build the embedded surface for the current step (D-01/D-03). Surface-bearing
  // steps (schedule/gym/shortcut_viewed) mount their real Phase-2 surface inline
  // with onComplete=handleAdvance, which advances the tour and triggers the
  // navigation effect above. Teaching-only steps (challenge/money) get NO
  // surface — the card keeps its "Next →" button (D-03). Neutral initial values
  // are passed (auto-skip-from-real-state is deferred to Phase 6, CONTEXT line 150).
  const surfaceNode = useMemo<React.ReactNode>(() => {
    switch (currentStepId) {
      case "schedule":
        return (
          <ScheduleSurface
            initialGoal={4}
            initialRestDays={[]}
            onComplete={handleAdvance}
          />
        );
      case "gym":
        return <GymSurface initialGymCount={0} onComplete={handleAdvance} />;
      case "shortcut_viewed":
        // Pure-UI practice check-in (D-05/TEACH-05) — ZERO API calls, never
        // touches the check-in endpoint. Advancing the tour is its only effect.
        return (
          <PracticeCheckIn reducedMotion={reducedMotion} onComplete={handleAdvance} />
        );
      default:
        // challenge / money are teaching-only — no surface, keep "Next →".
        return undefined;
    }
  }, [currentStepId, handleAdvance, reducedMotion]);

  // Ref holding current card data — synced each render so the stable component
  // always reads up-to-date values without recreating its type (WR-02).
  const tooltipDataRef = useRef({
    currentStepId,
    stepTitle,
    stepBody,
    surfaceNode,
    handleAdvance,
    handleDismiss,
  });
  tooltipDataRef.current = {
    currentStepId,
    stepTitle,
    stepBody,
    surfaceNode,
    handleAdvance,
    handleDismiss,
  };

  // Stable component reference created once on mount. joyride receives the same
  // component type across re-renders, so the tooltip tree (and ScheduleSurface /
  // GymSurface form state) is never unmounted between step updates (WR-02).
  // No safe-area wrapper here: adding padding inflates the tooltip's measured
  // size causing Joyride's position algorithm to place the card off-screen.
  // The card itself uses max-w-[calc(100vw-32px)] + mx-4 for horizontal safety.
  const TooltipAdapter = useMemo(
    () =>
      function StableTooltipAdapter(_props: TooltipRenderProps) {
        const {
          currentStepId: stepId,
          stepTitle: title,
          stepBody: body,
          surfaceNode: surface,
          handleAdvance: onAdvance,
          handleDismiss: onDismiss,
        } = tooltipDataRef.current;
        return (
          <CoachmarkCard
            stepId={stepId}
            title={title}
            body={body}
            surface={surface}
            onAdvance={onAdvance}
            onDismiss={onDismiss}
          />
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // MOUNT GATE: render nothing when inactive, anchor missing, or a dialog is
  // open. Silent degrade — no error UI ever (UI-SPEC §Error state, D-06).
  // Memoize the steps array so joyride receives a stable reference between
  // re-renders. A new array on every render can cause joyride to reset its
  // internal state unnecessarily (treating it as a new tour).
  const joyrideSteps = useMemo<Step[]>(
    () =>
      selector
        ? [{ target: selector, content: stepBody, title: stepTitle, placement: "auto" }]
        : [],
    [selector, stepBody, stepTitle]
  );

  if (!showing || !selector) {
    return null;
  }

  const portalElement =
    typeof document !== "undefined"
      ? document.getElementById("tour-root")
      : null;

  const joyrideProps: JoyrideProps = {
    steps: joyrideSteps,
    run: showing,
    // Controlled single-step mode: we render exactly the current step's anchor.
    stepIndex: 0,
    continuous: false,
    portalElement: portalElement ?? undefined,
    tooltipComponent: TooltipAdapter,
    // Hide Joyride's built-in arrow — CoachmarkCard is the full UI; the arrow
    // renders in wrong positions and is redundant with the spotlight (TOUR-02).
    arrowComponent: NullArrow,
    // Keep tooltip inside the viewport on both axes (TOUR-03). preventOverflow
    // with altAxis:true clamps horizontally AND vertically; flip ensures the
    // card switches sides before it overflows rather than after.
    floaterProps: {
      options: {
        modifiers: [
          {
            name: "preventOverflow",
            options: { boundary: "viewport", padding: 16, altAxis: true },
          },
          {
            name: "flip",
            options: { fallbackPlacements: ["top", "bottom", "left", "right"], padding: 16 },
          },
        ],
      },
    },
    // Disable joyride's own keyboard close handling (we own Escape, TOUR-04).
    options: {
      zIndex: COACHMARK_Z_INDEX,
      // Show the tooltip directly — no beacon click required (one-at-a-time
      // contextual coachmark, UI-SPEC).
      skipBeacon: true,
      // Click-through overlay (TOUR-02): clicking the dim layer does nothing,
      // the highlighted element stays interactive, input is never trapped.
      overlayClickAction: false,
      blockTargetInteraction: false,
      // We own Escape via the window handler so we can call dismiss() directly.
      dismissKeyAction: false,
      // Do NOT trap focus inside the tooltip — the rest of the page stays
      // reachable (UI-SPEC: no focus trap, TOUR-04).
      disableFocusTrap: true,
      // Recommended cutout dim tint (UI-SPEC §Color).
      overlayColor: "rgba(0,0,0,0.5)",
      spotlightRadius: 16,
      // Anchor-gating safety net: we already gate on the anchor existing, but
      // tell joyride not to wait/spotlight empty space (TOUR-01).
      targetWaitTimeout: 0,
      // Reduced motion (TOUR-04): skip the scroll animation. The card's own
      // enter animation is the globals.css animate-fade-up utility, which the
      // prefers-reduced-motion block already disables.
      skipScroll: reducedMotion,
    },
    styles: {
      // Dim layer is click-through — pointer-events:none so the page beneath
      // stays fully interactive (TOUR-02).
      overlay: { pointerEvents: "none" },
      // The custom card owns all visual UI; strip joyride's tooltip chrome.
      tooltip: { padding: 0, backgroundColor: "transparent" },
      tooltipContainer: { padding: 0 },
    },
  };

  const announce = `${stepTitle}. ${stepBody}`;

  return (
    <>
      <Joyride {...joyrideProps} />
      {/* aria-live region (TOUR-04): announce the current step's title + body.
          Portaled into #tour-root so it lives beside the overlay, sr-only. */}
      {portalElement
        ? createPortal(
            <div
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
              style={{ position: "absolute" }}
            >
              {announce}
            </div>,
            portalElement
          )
        : null}
    </>
  );
}
