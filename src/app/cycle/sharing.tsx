"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Avatar } from "@/components/avatar";

type Share = { userId: string; username: string | null };
type SearchResult = {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
};

const ERR_LABEL: Record<string, string> = {
  user_not_found: "No user with that username.",
  cannot_share_self: "You can't share with yourself.",
  validation_failed: "Enter a valid username.",
};

export function PeriodSharingManager() {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<Share[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

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

  // Debounced username search (mirrors the challenges invite typeahead).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.users ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Close the results dropdown when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const sharedIds = new Set(shares.map((s) => s.username?.toLowerCase()));

  async function add(username: string | null) {
    const value = (username ?? "").trim().replace(/^@/, "");
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
    setQuery("");
    setResults([]);
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Share cycle data
          </span>
          <span className="mt-1 block text-xs text-white/50">
            {loaded && shares.length > 0
              ? `Shared with ${shares.length} ${shares.length === 1 ? "person" : "people"}`
              : "No one can see it by default."}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/45 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="mt-4">
          <p className="text-xs text-white/50">
            People you add can view your cycle data from your profile. Search a username to add them.
          </p>

          <div ref={boxRef} className="relative mt-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a username…"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-10 w-full rounded-full border border-white/20 bg-white/[0.06] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/40"
            />

            {query.trim().length >= 2 ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-white/15 bg-[#0a0a0a] p-1 shadow-xl">
                {searching && results.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-white/40">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-white/40">No users found.</p>
                ) : (
                  results.map((u) => {
                    const already = u.username
                      ? sharedIds.has(u.username.toLowerCase())
                      : false;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={busy || already}
                        onClick={() => add(u.username)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        <Avatar
                          url={u.avatar_url}
                          name={u.name}
                          username={u.username}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">
                            {u.name?.trim() || `@${u.username}`}
                          </span>
                          {u.username ? (
                            <span className="block truncate text-xs text-white/45">
                              @{u.username}
                            </span>
                          ) : null}
                        </span>
                        {already ? (
                          <span className="shrink-0 text-[11px] text-white/40">Added</span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

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
        </div>
      ) : null}
    </section>
  );
}
