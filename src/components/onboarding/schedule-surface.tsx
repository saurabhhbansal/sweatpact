"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const DAYS: Array<{ n: number; label: string }> = [
  { n: 1, label: "Mo" },
  { n: 2, label: "Tu" },
  { n: 3, label: "We" },
  { n: 4, label: "Th" },
  { n: 5, label: "Fr" },
  { n: 6, label: "Sa" },
  { n: 0, label: "Su" },
];

export function ScheduleSurface({
  initialGoal,
  initialRestDays,
  onComplete,
}: {
  initialGoal: number;
  initialRestDays: number[];
  onComplete: () => void;
}) {
  const [goal, setGoal] = useState(initialGoal);
  const [restDays, setRestDays] = useState<number[]>(initialRestDays);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tooMany = restDays.length + goal > 7;

  function toggleDay(n: number) {
    setRestDays((prev) => (prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n]));
  }

  async function save(goNext: boolean) {
    if (goNext && tooMany) {
      setErr(`Rest days + goal can't exceed 7.`);
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekly_goal: goal, rest_days: restDays }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      return;
    }
    onComplete();
  }

  function skip() {
    onComplete();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Weekly gym goal</Label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setGoal(n)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition ${
                goal === n
                  ? "bg-white text-black"
                  : "border border-white/20 bg-white/[0.06] text-white/60 hover:bg-white/[0.12]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/45">
          {goal} day{goal === 1 ? "" : "s"} per week.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Rest days</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(({ n, label }) => {
            const active = restDays.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleDay(n)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition ${
                  active
                    ? "bg-white/25 text-white ring-1 ring-white/40"
                    : "border border-white/20 bg-white/[0.06] text-white/45 hover:bg-white/[0.12]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {tooMany ? (
          <p className="text-xs text-white/85">
            {restDays.length} rest days + {goal}-day goal = more than 7. Reduce one.
          </p>
        ) : (
          <p className="text-xs text-white/45">
            {restDays.length === 0
              ? "No rest days scheduled."
              : `${restDays.length} rest day${restDays.length === 1 ? "" : "s"} · ${7 - restDays.length} gym days available`}
          </p>
        )}
      </div>

      {err ? <p className="text-sm text-white/85">{err}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={skip}
          disabled={busy}
          className="text-sm text-white/55 underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
        <Button
          type="button"
          onClick={() => save(true)}
          disabled={busy || tooMany}
          className="ml-auto rounded-full"
        >
          {busy ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
