"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function WeeklyGoalPicker({
  initialWeeklyGoal,
  restDaysCount,
}: {
  initialWeeklyGoal: number;
  // Needed for the cross-validation error message (rest_days + weekly_goal ≤ 7).
  restDaysCount: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [goal, setGoal] = useState(initialWeeklyGoal);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!pendingRef.current) setGoal(initialWeeklyGoal);
  }, [initialWeeklyGoal]);

  async function pick(n: number) {
    if (busy || n === goal) return;
    pendingRef.current = true;
    setGoal(n);
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekly_goal: n }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        data.error === "too_many_rest_days"
          ? `Goal + rest days (${restDaysCount}) can't exceed 7.`
          : data.error ?? "Failed"
      );
      setGoal(initialWeeklyGoal);
      pendingRef.current = false;
      return;
    }
    pendingRef.current = false;
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pick(n)}
            disabled={busy}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition disabled:opacity-50 ${
              goal === n
                ? "bg-white text-black"
                : "border border-white/20 bg-white/[0.06] text-white/60 hover:bg-white/15"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {err ? (
        <p className="text-xs text-white/85">{err}</p>
      ) : (
        <p className="text-xs text-white/45">
          Days per week you aim to check in. Penalties apply when you fall short.
        </p>
      )}
    </div>
  );
}
