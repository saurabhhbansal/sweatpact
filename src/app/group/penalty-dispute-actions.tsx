"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PenaltyDisputeActions({ penaltyEventId, amount, userId, userName }: { penaltyEventId: string; amount: number; userId: string; userName: string }) {
  const router = useRouter();
  const [showDispute, setShowDispute] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function dispute() {
    if (!reason.trim()) {
      setErr("Add a reason");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/dispute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "penalty_event",
        target_id: penaltyEventId,
        reason,
      }),
    });
    setBusy(false);
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
      <Button
        size="sm"
        variant="ghost"
        className="rounded-full"
        onClick={() => setShowDispute((s) => !s)}
      >
        {showDispute ? "Cancel" : "Dispute"}
      </Button>
      {showDispute ? (
        <div className="flex flex-col gap-2">
          <input
            className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-sm text-white"
            placeholder="Why?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            size="sm"
            className="rounded-full"
            onClick={dispute}
            disabled={busy}
          >
            {busy ? "Filing…" : "File dispute"}
          </Button>
        </div>
      ) : null}
      {err ? <p className="text-destructive text-xs">{err}</p> : null}
    </div>
  );
}
