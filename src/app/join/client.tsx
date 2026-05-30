"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function JoinByCode({ code }: { code: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onJoin() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invite_code: code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Failed");
      return;
    }
    router.push(data.group?.id ? `/groups/${data.group.id}` : "/groups");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <Button className="w-full rounded-full" onClick={onJoin} disabled={busy}>
        {busy ? "Joining…" : "Join group"}
      </Button>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  );
}
