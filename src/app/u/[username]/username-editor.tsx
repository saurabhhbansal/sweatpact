"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; reason: string };

export function UsernameEditor({ currentUsername }: { currentUsername: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentUsername);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Resync local state when the server-provided username changes (after save +
  // refresh). Prevents stale value carrying over to a reused component.
  useEffect(() => {
    if (!editing) setValue(currentUsername);
  }, [currentUsername, editing]);

  useEffect(() => {
    if (!editing) return;
    const trimmed = value.trim();
    if (trimmed === currentUsername) {
      setStatus({ kind: "idle" });
      return;
    }
    if (!USERNAME_RE.test(trimmed)) {
      setStatus(
        trimmed.length === 0
          ? { kind: "idle" }
          : { kind: "unavailable", reason: "invalid_format" }
      );
      return;
    }
    setStatus({ kind: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username/check?u=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setStatus(
          data.available
            ? { kind: "available" }
            : { kind: "unavailable", reason: data.reason ?? "taken" }
        );
      } catch {
        setStatus({ kind: "idle" });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [value, editing, currentUsername]);

  async function save() {
    const trimmed = value.trim();
    if (trimmed === currentUsername) {
      setEditing(false);
      return;
    }
    if (status.kind !== "available") {
      setErr("Pick an available username.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: trimmed }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(
        data.error === "username_taken"
          ? "Already taken."
          : data.error ?? "Failed"
      );
      return;
    }
    setEditing(false);
    startTransition(() => {
      router.push(`/u/${trimmed}`);
      router.refresh();
    });
  }

  function cancel() {
    setValue(currentUsername);
    setEditing(false);
    setStatus({ kind: "idle" });
    setErr(null);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm text-white/55 hover:bg-white/[0.06] hover:text-white"
      >
        <span>@{currentUsername}</span>
        <Pencil className="h-3 w-3 text-white/35 transition group-hover:text-white/70" />
      </button>
    );
  }

  return (
    <div className="w-full max-w-xs space-y-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">@</span>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          className="pl-7"
          maxLength={20}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
        />
      </div>
      <p className="min-h-[1rem] text-center text-xs">
        {status.kind === "checking" && <span className="text-white/45">Checking…</span>}
        {status.kind === "available" && (
          <span className="text-white">@{value.trim()} is available</span>
        )}
        {status.kind === "unavailable" && (
          <span className="text-white/70">
            {status.reason === "taken"
              ? "Already taken."
              : status.reason === "reserved"
                ? "Reserved name."
                : "3–20 chars · letters, numbers, _"}
          </span>
        )}
      </p>
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
          disabled={busy || (status.kind !== "available" && value.trim() !== currentUsername)}
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
