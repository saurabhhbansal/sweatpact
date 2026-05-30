"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export function UsernamePicker() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "available" }
    | { kind: "unavailable"; reason: string }
  >({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const value = username.trim();
    if (!USERNAME_RE.test(value)) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username/check?u=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (data.available) {
          setStatus({ kind: "available" });
        } else {
          setStatus({ kind: "unavailable", reason: data.reason ?? "taken" });
        }
      } catch {
        setStatus({ kind: "idle" });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = username.trim();
    if (!USERNAME_RE.test(value)) {
      setErr("Use 3–20 letters, numbers, or underscores.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: value }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(
        data.error === "username_taken"
          ? "That username is already taken."
          : data.error ?? "Failed"
      );
      return;
    }
    startTransition(() => {
      router.push("/onboarding/schedule");
      router.refresh();
    });
  }

  const canSubmit = status.kind === "available" && !busy;

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">@</span>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="border-white/25 bg-white/10 pl-7"
            placeholder="gym_warrior"
            autoComplete="off"
            autoFocus
          />
        </div>
        <p className="min-h-[1.25rem] text-xs">
          {status.kind === "checking" && <span className="text-white/45">Checking…</span>}
          {status.kind === "available" && (
            <span className="text-white">@{username.trim()} is available</span>
          )}
          {status.kind === "unavailable" && (
            <span className="text-white/70">
              {status.reason === "taken"
                ? "Already taken."
                : status.reason === "reserved"
                  ? "That name is reserved."
                  : "Invalid format."}
            </span>
          )}
          {status.kind === "idle" && username.length > 0 && (
            <span className="text-white/40">3–20 chars · letters, numbers, _</span>
          )}
        </p>
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" disabled={!canSubmit} className="w-full rounded-full">
        {busy ? "Saving…" : "Claim username"}
      </Button>
    </form>
  );
}
