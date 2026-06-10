"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const OPTIONS: Array<{ value: "male" | "female"; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export function GenderPicker({
  initialGender,
}: {
  initialGender: "male" | "female" | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [gender, setGender] = useState<"male" | "female" | null>(initialGender);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!pendingRef.current) setGender(initialGender);
  }, [initialGender]);

  async function pick(value: "male" | "female") {
    if (busy || value === gender) return;
    pendingRef.current = true;
    const prev = gender;
    setGender(value);
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gender: value }),
    });
    setBusy(false);
    pendingRef.current = false;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      setGender(prev);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => pick(opt.value)}
            disabled={busy}
            aria-pressed={gender === opt.value}
            className={`flex h-9 flex-1 items-center justify-center rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 ${
              gender === opt.value
                ? "bg-white text-black"
                : "border border-white/20 bg-white/[0.06] text-white/60 hover:bg-white/15"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {err ? (
        <p role="alert" className="text-xs text-white/85">{err}</p>
      ) : (
        <p className="text-xs text-white/45">
          Used to show the period-day excuse option and Cycle tab.
        </p>
      )}
    </div>
  );
}
