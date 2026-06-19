"use client";

import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PACT_LIVE_SEEN_KEY, shouldShowPactLive } from "@/lib/onboarding/pact-live";

/**
 * "Pact is live" completion overlay (UX-03) — the emotional peak of v1.1.
 *
 * Fires once on /groups when the viewer has their first ACTIVE challenge (D-01:
 * the trigger is challenge activation, not `isTourComplete()`). Sharp,
 * consequence-first copy + a single forward exit ("Let's go →"). Works for both
 * self-starter and invited paths because both land on /groups with an active
 * membership.
 *
 * Shown exactly once: dismissal fire-and-forgets a PATCH that appends
 * `pact_live_seen` to `completed_steps` (D-03). That key is NOT a teaching key,
 * so it never affects tour completion or any financial state (T-06-06).
 *
 * Renders at z-[120] — above the coachmark (z-[110]) and the InstallGate
 * (z-[100]) — so it is the topmost surface when active. There is intentionally
 * NO corner X: the moment has one exit, forward.
 */
export function PactLiveOverlay({
  hasActiveChallenge,
  completedSteps,
}: {
  hasActiveChallenge: boolean;
  completedSteps: string[];
}) {
  // Portal/Dialog must only render client-side (mirrors notifications-overlay).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Tracks dismiss locally so re-renders before the server round-trip confirms
  // `pact_live_seen` don't cause the overlay to re-open.
  const [seenLocally, setSeenLocally] = useState(false);

  // Open exactly when the suppression predicate allows it. Seeding from the
  // predicate keeps the open state in sync with the persisted seen-flag.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (seenLocally) return;
    setOpen(
      shouldShowPactLive({ mounted, hasActiveChallenge, completedSteps })
    );
  }, [mounted, hasActiveChallenge, completedSteps, seenLocally]);

  // Guard the persistence write so it fires once even if Escape and the CTA
  // both drive onOpenChange(false).
  const persistedRef = useRef(false);

  function persistSeen() {
    if (persistedRef.current) return;
    persistedRef.current = true;
    // Fire-and-forget: the overlay never blocks on the network. A failed write
    // only means it may show once more on a later load — never a hard error.
    fetch("/api/onboarding-progress", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ complete_step: PACT_LIVE_SEEN_KEY }),
    }).catch(() => {});
  }

  function dismiss() {
    setSeenLocally(true);
    setOpen(false);
    persistSeen();
  }

  if (seenLocally || !shouldShowPactLive({ mounted, hasActiveChallenge, completedSteps })) {
    return null;
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl animate-overlay-in" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center px-6 text-center text-white outline-none animate-fade-up"
          // No corner X — single forward exit only (UI-SPEC).
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-6">
            <Lock className="h-8 w-8 text-white sm:h-10 sm:w-10" aria-hidden="true" />

            <div className="space-y-3">
              <DialogPrimitive.Title className="text-3xl font-semibold text-white sm:text-4xl">
                Your pact is live.
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-white/70 sm:text-base">
                Real money&apos;s on the line now. Show up — or pay up.
              </DialogPrimitive.Description>
            </div>
          </div>

          <div
            className="absolute inset-x-0 bottom-0 px-6 pt-6"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
          >
            <div className="mx-auto w-full max-w-sm">
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={dismiss}
              >
                Let&rsquo;s go →
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
