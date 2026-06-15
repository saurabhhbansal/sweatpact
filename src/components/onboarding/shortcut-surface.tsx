"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShortcutSurface({ onComplete }: { onComplete: () => void }) {
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    // Record the Shortcut "viewed" signal via the Phase-1 onboarding-progress
    // write path (D-05). This surface does NOT flip onboarding_complete — that
    // legacy concern lives in the legacy shell's onComplete so a future
    // walkthrough mount cannot prematurely end onboarding.
    try {
      const res = await fetch("/api/onboarding-progress", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ complete_step: "shortcut_viewed" }),
      });
      // Best-effort: parse-and-fallback, but do not block completion on it.
      await res.json().catch(() => ({}));
    } catch {
      // best-effort: swallow network error, still proceed to onComplete
    } finally {
      setBusy(false);
    }
    onComplete();
  }

  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={finish}
        disabled={busy}
        className="text-sm text-white/55 underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
      >
        Skip for now
      </button>
      <Button
        type="button"
        onClick={finish}
        disabled={busy}
        className="ml-auto rounded-full"
      >
        {busy ? "Saving…" : "Done"}
      </Button>
    </div>
  );
}
