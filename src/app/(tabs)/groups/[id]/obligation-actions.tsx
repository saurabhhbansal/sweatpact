"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ObligationActions({ obligationIds }: { obligationIds: string[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function settle() {
    setBusy(true);
    setErr(null);
    for (const id of obligationIds) {
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ obligation_id: id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Failed");
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <Button size="sm" variant="secondary" className="rounded-full" onClick={settle} disabled={busy}>
        {busy ? "Settling…" : "Mark settled"}
      </Button>
      {err ? <p className="text-destructive">{err}</p> : null}
    </div>
  );
}
