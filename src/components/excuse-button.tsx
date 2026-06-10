"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Flow = "light" | "medium" | "heavy";

export function ExcuseButton({
  gender,
  onOptimistic,
  onClose,
}: {
  gender: string;
  onOptimistic?: (status: string) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"menu" | "period_flow">("menu");

  async function submit(status: string, flowLevel?: Flow) {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { status };
    if (flowLevel) body.flow_level = flowLevel;
    const res = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed to log status");
      return;
    }
    onOptimistic?.(status);
    onClose?.();
    startTransition(() => router.refresh());
  }

  function cancel() {
    setMode("menu");
    setError(null);
    onClose?.();
  }

  if (mode === "period_flow") {
    return (
      <div className="space-y-2 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
        <p className="mb-2 text-center text-xs text-white/45">Flow today</p>
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "light")} disabled={busy}>Light</Button>
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "medium")} disabled={busy}>Medium</Button>
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "heavy")} disabled={busy}>Heavy</Button>
        </div>
        <Button variant="ghost" className="mt-1 w-full text-xs text-white/45" onClick={() => setMode("menu")} disabled={busy}>Back</Button>
        {error && <p role="alert" aria-live="assertive" className="mt-1 text-center text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
      <p className="mb-2 text-center text-xs text-white/45">Log an excused day</p>
      <div className={`grid gap-2 ${gender === "female" ? "grid-cols-3" : "grid-cols-2"}`}>
        <Button size="sm" variant="secondary" onClick={() => submit("sick_day")} disabled={busy}>Sick day</Button>
        <Button size="sm" variant="secondary" onClick={() => submit("rest_day")} disabled={busy}>Rest day</Button>
        {gender === "female" && (
          <Button size="sm" variant="secondary" onClick={() => setMode("period_flow")} disabled={busy}>Period</Button>
        )}
      </div>
      <Button variant="ghost" className="mt-1 w-full text-xs text-white/45" onClick={cancel} disabled={busy}>Cancel</Button>
      {error && <p role="alert" aria-live="assertive" className="mt-1 text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
