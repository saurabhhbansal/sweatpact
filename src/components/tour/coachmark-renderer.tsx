"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Joyride,
  type Props as JoyrideProps,
  type Step,
  type TooltipRenderProps,
} from "react-joyride";
import { CoachmarkCard } from "@/components/tour/coachmark-card";
import { STEPS } from "@/lib/onboarding/steps";
import { useTour } from "@/components/tour-provider";

/**
 * Placeholder body copy (UI-SPEC §Copywriting "Placeholder step body (POC)").
 * Real teaching copy lands in Phase 5; this proves wrapping/positioning only.
 */
const PLACEHOLDER_BODY =
  "Coachmarks will spotlight each part of SweatPact, one at a time. Real lessons land in the next phase.";

/** z-index ABOVE InstallGate (z-[100]); see UI-SPEC §Z-index (TOUR-02). */
const COACHMARK_Z_INDEX = 110;

/** True while any Radix dialog is open (D-04 pause condition). */
function anyDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector('[role="dialog"][data-state="open"]') !== null;
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

  // --- Anchor readiness gate (TOUR-01) -----------------------------------
  // Track whether the current step's `data-tour` target is actually mounted.
  // We never spotlight empty space: joyride only runs once this is true.
  const [anchorReady, setAnchorReady] = useState(false);

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
      setAnchorReady(false);
      return;
    }
    const check = () => setAnchorReady(document.querySelector(selector) !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isActive, selector]);

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

  // A step is "showing" only when active, its anchor is mounted, and no Radix
  // dialog is open. This single predicate drives joyride `run`, the keyboard
  // handler, the aria-live announcement, and focus management.
  const showing = isActive && anchorReady && !dialogOpen;

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

  const stepTitle = useMemo(() => {
    const step = STEPS.find((s) => s.id === currentStepId);
    return step?.title ?? "";
  }, [currentStepId]);

  // Move focus to the card's primary "Next →" button when a step appears
  // (TOUR-04). The card is portaled by joyride into #tour-root; we query its
  // first <button> (the "Next →" CTA renders before "Skip tour") once it lands.
  // Focus is NOT trapped (UI-SPEC) — we only move focus once per appearance.
  useEffect(() => {
    if (!showing) return;
    const root = document.getElementById("tour-root");
    if (!root) return;
    let cancelled = false;
    const focusPrimary = () => {
      if (cancelled) return;
      const primary = root.querySelector<HTMLButtonElement>("button");
      if (primary) {
        primary.focus();
        return;
      }
      // Tooltip not portaled yet — retry on the next frame until it appears.
      requestAnimationFrame(focusPrimary);
    };
    const raf = requestAnimationFrame(focusPrimary);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [showing, currentStepId]);

  // Custom tooltip adapter — renders CoachmarkCard (D-02 owns all visual UI).
  // The step's `title` comes from STEPS; body is the placeholder.
  const TooltipAdapter = useCallback(
    (_props: TooltipRenderProps) => (
      // Safe-area wrapper (TOUR-03): pad edges with max(16px, env(safe-area-inset-*))
      // so the card never sits under the notch/home indicator/rounded corner.
      <div
        style={{
          paddingTop: "max(16px, env(safe-area-inset-top))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          paddingLeft: "max(16px, env(safe-area-inset-left))",
        }}
      >
        <CoachmarkCard
          stepId={currentStepId}
          title={stepTitle}
          body={PLACEHOLDER_BODY}
          onAdvance={handleAdvance}
          onDismiss={handleDismiss}
        />
      </div>
    ),
    [currentStepId, stepTitle, handleAdvance, handleDismiss]
  );

  // MOUNT GATE: render nothing when inactive, anchor missing, or a dialog is
  // open. Silent degrade — no error UI ever (UI-SPEC §Error state, D-06).
  if (!showing || !selector) {
    // Still render the (empty) aria-live region container is unnecessary when
    // nothing is showing; announcements only matter while a step is visible.
    return null;
  }

  const steps: Step[] = [
    {
      target: selector,
      content: PLACEHOLDER_BODY,
      title: stepTitle,
      placement: "auto",
    },
  ];

  const portalElement =
    typeof document !== "undefined"
      ? document.getElementById("tour-root")
      : null;

  const joyrideProps: JoyrideProps = {
    steps,
    run: showing,
    // Controlled single-step mode: we render exactly the current step's anchor.
    stepIndex: 0,
    continuous: false,
    portalElement: portalElement ?? undefined,
    tooltipComponent: TooltipAdapter,
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

  const announce = `${stepTitle}. ${PLACEHOLDER_BODY}`;

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
