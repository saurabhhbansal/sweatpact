"use client";

import { Button } from "@/components/ui/button";
import { deriveDotStates } from "@/lib/onboarding/coachmark-progress";
import { cn } from "@/lib/utils";

/**
 * Props for {@link CoachmarkCard}. The card is pure presentation driven entirely
 * by these props — it imports no tour library and reads no tour context. The
 * renderer (Plan 03) supplies copy and the advance/dismiss callbacks.
 *
 * @property stepId    - the active step id (drives the dot indicator); null = no current step.
 * @property title     - step heading (placeholder copy in Phase 4; real copy in Phase 5).
 * @property body      - 1-2 sentence instructional body text.
 * @property onAdvance - called when the user clicks "Next →".
 * @property onDismiss - called when the user clicks "Skip tour".
 * @property surface   - optional embedded setup surface (D-01) rendered in a
 *   bounded-scroll slot between body and dots (D-02). When present, the
 *   standalone "Next →" button is hidden (D-03) — the surface supplies its own
 *   Continue / Skip-for-now CTA. "Skip tour" always remains (ONB-04).
 */
export type CoachmarkCardProps = {
  stepId: string | null;
  title: string;
  body: string;
  onAdvance: () => void;
  onDismiss: () => void;
  surface?: React.ReactNode;
};

/**
 * The locked coachmark card shell (UI-SPEC §"Card structure (D-05)").
 *
 * Top→bottom: step title → body → 5-dot progress indicator → white "Next →"
 * button → muted "Skip tour" link. The dot row is derived from
 * `deriveDotStates(stepId)` so its order and count track the STEPS registry
 * (D-07). Styled entirely from existing tokens — `.glass-card` surface, the
 * `Button` default variant, and an existing animate utility so the card's enter
 * animation auto-disables under `prefers-reduced-motion`.
 *
 * Both controls are real focusable `<button>`s (keyboard-operable, TOUR-04);
 * focus is NOT trapped — Tab moves through them and out. The global
 * Enter/Space=advance, Escape=dismiss, focus-on-appear, and aria-live wiring is
 * the renderer's job (Plan 03). This component takes no tour-library or
 * tour-context dependency.
 */
export function CoachmarkCard({
  stepId,
  title,
  body,
  onAdvance,
  onDismiss,
  surface,
}: CoachmarkCardProps) {
  const dots = deriveDotStates(stepId);

  return (
    <div
      className={cn(
        "glass-card animate-fade-up rounded-2xl p-4 text-white",
        surface
          ? "w-[360px] max-w-[calc(100vw-32px)] mx-4"
          : "w-[300px] max-w-[calc(100vw-32px)] mx-4"
      )}
    >
      {/* 1. Step title — 16px semibold */}
      <h2 className="text-base font-semibold text-white">{title}</h2>

      {/* 2. Body — 14px normal, sm gap below the title */}
      <p className="mt-2 text-sm font-normal text-white">{body}</p>

      {/* 2b. Embedded setup surface (D-01/D-02) — bounded-scroll slot, only when provided */}
      {surface ? (
        <div className="mt-3 max-h-[calc(80vh-8rem)] overflow-y-auto">{surface}</div>
      ) : null}

      {/* 3. Dot indicator — one dot per STEPS entry; current=white, past=white/40, future=white/15 (D-07) */}
      <div
        className="mt-2 flex items-center justify-center gap-1"
        aria-hidden="true"
      >
        {dots.map((dot) => (
          <span
            key={dot.id}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              dot.state === "current" && "bg-white",
              dot.state === "past" && "bg-white/40",
              dot.state === "future" && "bg-white/15"
            )}
          />
        ))}
      </div>

      {/* 4. Primary "Next →" button — hidden on surface steps (D-03); the surface
          supplies its own Continue/Skip-for-now CTA. Teaching-only steps keep it. */}
      {surface ? null : (
        <Button type="button" onClick={onAdvance} className="mt-3 h-11 w-full">
          Next →
        </Button>
      )}

      {/* 5. "Skip tour" — muted secondary link, real button, 44px tap target (D-06) */}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 flex h-11 w-full items-center justify-center text-[13px] text-white/60 transition-colors hover:text-white/85"
      >
        Skip tour
      </button>
    </div>
  );
}
