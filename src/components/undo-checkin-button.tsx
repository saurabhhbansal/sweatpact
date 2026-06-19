"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function UndoCheckinButton({ onUndo }: { onUndo: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUndo() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkin", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error === "no_unverified_checkin" ? "No unverified check-in to undo." : "Undo failed. Try again.");
      return;
    }
    onUndo();
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleUndo}
        disabled={busy}
        className="mx-auto flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-4 py-1.5 text-sm text-white/60 transition hover:bg-white/[0.10] hover:text-white/80 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Undo check-in
      </button>
      {error ? (
        <p role="alert" aria-live="assertive" className="text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
