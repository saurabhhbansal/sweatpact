"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FinishOnboardingButtons() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onboarding_complete: true }),
    });
    setBusy(false);
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
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
