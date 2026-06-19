"use client";

import { Check } from "lucide-react";
import { TEACHING_KEYS } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

/**
 * The display label for each completion-gating teaching key (UI-SPEC line 121).
 * Keyed by TEACHING_KEY so the labels never drift from the registry source of
 * truth in `steps.ts`.
 */
const KEY_LABELS: Record<string, string> = {
  gym: "Set your gym",
  challenge: "Start a pact",
  money: "See the money model",
  shortcut_viewed: "Set up check-ins",
};

/**
 * The dashboard "getting started" checklist (UX-01). One row per
 * `TEACHING_KEY`, each showing a success-colored checkmark once its key is in
 * `completedSteps`. Hides entirely once all four keys are complete.
 *
 * Completion is read SERVER-SIDE in the dashboard RSC (via the request-cached
 * `getOnboardingProgress()`) and passed here as `completedSteps` — the frozen
 * tour context is NOT consumed and `TourValue` is NOT extended (D-08). This is a
 * pure presentation component over its prop.
 */
export function GettingStartedChecklist({
  completedSteps,
}: {
  completedSteps: string[];
}) {
  // Hide the whole checklist once every teaching key is complete (the tour is
  // done — specifics line 142).
  if (TEACHING_KEYS.every((key) => completedSteps.includes(key))) {
    return null;
  }

  return (
    <div className="animate-fade-up-item shrink-0 rounded-[2rem] glass-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
        Getting started
      </p>
      <ul className="mt-3 space-y-2">
        {TEACHING_KEYS.map((key) => {
          const done = completedSteps.includes(key);
          return (
            <li key={key} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  done
                    ? "animate-state-in border-transparent bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"
                    : "border-white/20"
                )}
                aria-hidden
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </span>
              <span
                className={cn(
                  "text-sm",
                  done ? "text-white/60" : "text-white"
                )}
              >
                {KEY_LABELS[key] ?? key}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
