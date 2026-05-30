"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Mode = "menu" | "period_flow";
type Flow = "light" | "medium" | "heavy";

export function ExcuseButton({
  gender,
  onOptimistic,
}: {
  gender: string;
  onOptimistic?: (status: string) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");

  async function submit(status: string, flowLevel?: Flow) {
    setBusy(true);
    setError(null);
    setMsg(null);
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
      setError(
        data.error === "max_rest_days_reached"
          ? "You've already used 2 rest days this week."
          : data.error || "Failed to log status"
      );
      return;
    }
    setMsg("Status logged.");
    setExpanded(false);
    setMode("menu");
    onOptimistic?.(status);
    startTransition(() => router.refresh());
  }

  function reset() {
    setExpanded(false);
    setMode("menu");
    setError(null);
    setMsg(null);
  }

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        className="w-full mt-2 text-xs text-white/60"
        onClick={() => setExpanded(true)}
      >
        Log excused day...
      </Button>
    );
  }

  if (mode === "period_flow") {
    return (
      <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="mb-2 text-center text-xs text-white/50">Flow today</p>
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "light")} disabled={busy}>
            Light
          </Button>
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "medium")} disabled={busy}>
            Medium
          </Button>
          <Button size="sm" variant="secondary" onClick={() => submit("period_day", "heavy")} disabled={busy}>
            Heavy
          </Button>
        </div>
        <Button
          variant="ghost"
          className="mt-2 w-full text-xs text-muted-foreground"
          onClick={() => setMode("menu")}
          disabled={busy}
        >
          Back
        </Button>
        {error && <p className="mt-1 text-center text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="mb-2 text-center text-xs text-white/50">Log an excused day</p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={() => submit("sick_day")} disabled={busy}>
          Sick day
        </Button>
        <Button size="sm" variant="secondary" onClick={() => submit("rest_day")} disabled={busy}>
          Rest day
        </Button>
        {gender === "female" && (
          <Button size="sm" variant="secondary" onClick={() => setMode("period_flow")} disabled={busy}>
            Period
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        className="mt-2 w-full text-xs text-muted-foreground"
        onClick={reset}
        disabled={busy}
      >
        Cancel
      </Button>
      {error && <p className="mt-1 text-center text-xs text-destructive">{error}</p>}
      {msg && <p className="mt-1 text-center text-xs text-success">{msg}</p>}
    </div>
  );
}
