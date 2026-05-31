"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Share = { userId: string; username: string | null };

const ERR_LABEL: Record<string, string> = {
  user_not_found: "No user with that username.",
  cannot_share_self: "You can't share with yourself.",
  validation_failed: "Enter a valid username.",
};

export function PeriodSharingManager() {
  const [shares, setShares] = useState<Share[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/cycle/sharing", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setShares(data.shares ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = username.trim().replace(/^@/, "");
    if (!value || busy) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/cycle/sharing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: value }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(ERR_LABEL[data.error] ?? "Couldn't add user.");
      return;
    }
    setUsername("");
    await load();
  }

  async function remove(name: string | null) {
    if (!name || busy) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/cycle/sharing", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: name }),
    });
    setBusy(false);
    if (res.ok) await load();
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
        Cycle data sharing
      </p>
      <p className="mt-1 text-xs text-white/50">
        These people can view your cycle data from your profile. No one can see it by default.
      </p>

      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect="off"
          className="h-10 flex-1 rounded-full border border-white/20 bg-white/[0.06] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/40"
        />
        <button
          type="submit"
          disabled={busy || username.trim().length === 0}
          className="h-10 shrink-0 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {err ? <p className="mt-2 text-xs text-rose-300">{err}</p> : null}

      <div className="mt-3 space-y-2">
        {!loaded ? null : shares.length === 0 ? (
          <p className="text-xs text-white/35">Not shared with anyone yet.</p>
        ) : (
          shares.map((s) => (
            <div
              key={s.userId}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5"
            >
              <span className="text-sm text-white">@{s.username ?? "unknown"}</span>
              <button
                type="button"
                onClick={() => remove(s.username)}
                disabled={busy}
                aria-label={`Remove @${s.username}`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
