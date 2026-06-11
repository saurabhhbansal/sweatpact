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

  if (mode === "period_flow") {
    return (
      <div className="space-y-3">
        <h2 className="text-center text-base font-semibold text-white">Flow today</h2>
        <p className="text-center text-sm text-white/65">
          Logging a period day keeps your streak safe.
        </p>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "light")} disabled={busy}>Light</Button>
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "medium")} disabled={busy}>Medium</Button>
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "heavy")} disabled={busy}>Heavy</Button>
        </div>
        <Button variant="ghost" className="w-full text-xs text-white/45" onClick={() => setMode("menu")} disabled={busy}>Back</Button>
        {error && <p role="alert" aria-live="assertive" className="text-center text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-center text-base font-semibold text-white">Log an excused day</h2>
      <p className="text-center text-sm text-white/65">
        Pick a reason — your streak stays safe.
      </p>
      <div className={`grid gap-2 pt-1 ${gender === "female" ? "grid-cols-3" : "grid-cols-2"}`}>
        <Button size="sm" variant="secondary" onClick={() => submit("sick_day")} disabled={busy}>Sick day</Button>
        <Button size="sm" variant="secondary" onClick={() => submit("rest_day")} disabled={busy}>Rest day</Button>
        {gender === "female" && (
          <Button size="sm" variant="secondary" onClick={() => setMode("period_flow")} disabled={busy}>Period</Button>
        )}
      </div>
      {error && <p role="alert" aria-live="assertive" className="text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
