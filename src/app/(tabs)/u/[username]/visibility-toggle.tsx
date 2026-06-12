"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export function VisibilityToggle({
  initial,
}: {
  initial: "public" | "private";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState<"public" | "private">(initial);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!pendingRef.current) setValue(initial);
  }, [initial]);

  async function set(next: "public" | "private") {
    if (busy || next === value) return;
    const prev = value;
    setValue(next);
    setBusy(true);
    pendingRef.current = true;
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile_visibility: next }),
    });
    setBusy(false);
    pendingRef.current = false;
    if (!res.ok) {
      setValue(prev);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-[1.7rem] glass-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Profile visibility</p>
          <p className="mt-0.5 text-xs text-white/55">
            {value === "public"
              ? "Anyone can see your stats."
              : "Only people in your challenges can see your stats."}
          </p>
        </div>
        <div className="flex shrink-0 rounded-full border border-white/15 bg-white/[0.04] p-0.5">
          <button
            type="button"
            onClick={() => set("public")}
            disabled={busy}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
              value === "public" ? "bg-white text-black" : "text-white/55 hover:text-white"
            }`}
            aria-pressed={value === "public"}
          >
            <Eye className="h-3.5 w-3.5" />
            Public
          </button>
          <button
            type="button"
            onClick={() => set("private")}
            disabled={busy}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
              value === "private" ? "bg-white text-black" : "text-white/55 hover:text-white"
            }`}
            aria-pressed={value === "private"}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Private
          </button>
        </div>
      </div>
    </div>
  );
}
