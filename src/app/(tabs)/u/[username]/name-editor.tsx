"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function NameEditor({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Resync local state when the server-provided name changes (e.g. after a
  // route.refresh()). Prevents stale buffer when the component is reused.
  useEffect(() => {
    if (!editing) setValue(currentName);
  }, [currentName, editing]);

  async function save() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: value.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  }

  function cancel() {
    setValue(currentName);
    setEditing(false);
    setErr(null);
  }

  if (!editing) {
    const display = currentName.trim() || "Add your name";
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex min-w-0 max-w-full items-center gap-2 rounded-md px-2 py-1 text-2xl font-semibold text-white hover:bg-white/[0.06]"
      >
        <span className="truncate">{display}</span>
        <Pencil className="h-4 w-4 shrink-0 text-white/40 transition group-hover:text-white/70" />
      </button>
    );
  }

  return (
    <div className="w-full max-w-xs space-y-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Your name"
        maxLength={100}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
      />
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:opacity-50"
          aria-label="Save"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
      {err ? <p className="text-center text-xs text-white/85">{err}</p> : null}
    </div>
  );
}
