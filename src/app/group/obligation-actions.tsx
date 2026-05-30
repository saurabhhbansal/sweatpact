"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ObligationActions({ obligationId }: { obligationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState(false);
  const [reason, setReason] = useState("");

  async function settle() {
    setBusy("settle");
    setErr(null);
    const res = await fetch("/api/settlements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ obligation_id: obligationId }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  async function dispute() {
    if (!reason.trim()) {
      setErr("Add a reason");
      return;
    }
    setBusy("dispute");
    setErr(null);
    const res = await fetch("/api/dispute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "obligation",
        target_id: obligationId,
        reason,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Failed");
      return;
    }
    setShowDispute(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className="rounded-full" onClick={settle} disabled={!!busy}>
          {busy === "settle" ? "Settling…" : "Mark settled"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => setShowDispute((s) => !s)}
        >
          Dispute
        </Button>
      </div>
      {showDispute ? (
        <div className="flex flex-col gap-2">
          <input
            className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-sm text-white"
            placeholder="Why?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button size="sm" className="rounded-full" onClick={dispute} disabled={!!busy}>
            {busy === "dispute" ? "Filing…" : "File dispute"}
          </Button>
        </div>
      ) : null}
      {err ? <p className="text-destructive">{err}</p> : null}
    </div>
  );
}
