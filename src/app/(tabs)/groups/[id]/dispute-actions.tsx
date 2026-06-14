"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Manager-only uphold/void controls shown on an open dispute. "Void" cancels
 * the disputed debt; "Uphold" keeps it and rejects the complaint.
 */
export function DisputeResolveActions({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | "void" | "uphold">(null);
  const [err, setErr] = useState<string | null>(null);

  async function resolve(action: "void" | "uphold") {
    setBusy(action);
    setErr(null);
    const res = await fetch("/api/dispute/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dispute_id: disputeId, action }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Button
        size="sm"
        className="rounded-full"
        onClick={() => resolve("void")}
        disabled={busy !== null}
      >
        {busy === "void" ? "Voiding…" : "Void debt"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-full"
        onClick={() => resolve("uphold")}
        disabled={busy !== null}
      >
        {busy === "uphold" ? "Upholding…" : "Uphold"}
      </Button>
      {err ? <p className="text-destructive text-xs">{err}</p> : null}
    </div>
  );
}

/**
 * Lets the owing member raise a dispute against an obligation they're on the
 * hook for. Files against a single obligation id (the route resolves the group
 * from it).
 */
export function FileDisputeButton({ obligationId }: { obligationId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function file() {
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
        target_type: "obligation",
        target_id: obligationId,
        reason,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Failed");
      return;
    }
    setOpen(false);
    setReason("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="text-xs">
      <button
        type="button"
        className="text-white/45 underline-offset-2 transition hover:text-white/70 hover:underline"
        onClick={() => setOpen((s) => !s)}
      >
        {open ? "Cancel" : "Dispute this"}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          <input
            className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-sm text-white"
            placeholder="Why is this wrong?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button size="sm" className="rounded-full" onClick={file} disabled={busy}>
            {busy ? "Filing…" : "File dispute"}
          </Button>
        </div>
      ) : null}
      {err ? <p className="text-destructive mt-1 text-xs">{err}</p> : null}
    </div>
  );
}
