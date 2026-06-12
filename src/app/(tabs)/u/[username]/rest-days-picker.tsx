"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const DAYS: Array<{ n: number; label: string }> = [
  { n: 1, label: "Mo" },
  { n: 2, label: "Tu" },
  { n: 3, label: "We" },
  { n: 4, label: "Th" },
  { n: 5, label: "Fr" },
  { n: 6, label: "Sa" },
  { n: 0, label: "Su" },
];

export function RestDaysPicker({
  initialRestDays,
  weeklyGoal,
}: {
  initialRestDays: number[];
  weeklyGoal: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [restDays, setRestDays] = useState<number[]>(initialRestDays);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pendingRef = useRef(false);

  // Resync from server state when not in the middle of a save.
  useEffect(() => {
    if (!pendingRef.current) setRestDays(initialRestDays);
  }, [initialRestDays]);

  async function persist(next: number[]) {
    pendingRef.current = true;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rest_days: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        data.error === "too_many_rest_days"
          ? `Rest days + weekly goal (${weeklyGoal}) can't exceed 7.`
          : data.error ?? "Failed"
      );
      // Revert local state
      setRestDays(initialRestDays);
      pendingRef.current = false;
      return;
    }
    pendingRef.current = false;
    startTransition(() => router.refresh());
  }

  function toggle(n: number) {
    if (busy) return;
    const next = restDays.includes(n)
      ? restDays.filter((d) => d !== n)
      : [...restDays, n];
    setRestDays(next);
    persist(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {DAYS.map(({ n, label }) => {
          const active = restDays.includes(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              disabled={busy}
              aria-pressed={active}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50 ${
                active
                  ? "bg-white/25 text-white"
                  : "border border-white/20 bg-white/[0.06] text-white/45 hover:bg-white/[0.12]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {err ? (
        <p role="alert" className="text-xs text-white/85">{err}</p>
      ) : (
        <p className="text-xs text-white/45">
          {restDays.length === 0
            ? "No rest days — every day is a gym day."
            : `${restDays.length} rest day${restDays.length === 1 ? "" : "s"} · ${7 - restDays.length} gym days available`}
        </p>
      )}
    </div>
  );
}
