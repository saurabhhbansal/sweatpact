"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Avatar } from "@/components/avatar";

type UserResult = {
  id: string;
  username: string;
  name: string;
  profile_visibility: "public" | "private";
  avatar_url: string | null;
};

export function UserSearch({
  placeholder = "Search by username or name…",
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.users ?? []);
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="border-white/25 bg-white/10 pl-9"
          autoComplete="off"
        />
      </div>
      {busy && query.trim().length >= 2 ? (
        <p className="mt-2 text-xs text-white/45">Searching…</p>
      ) : results.length > 0 ? (
        <ul className="mt-2 divide-y divide-white/10 overflow-hidden rounded-[1.4rem] border border-white/10 bg-card/55 backdrop-blur-xl">
          {results.map((user) => (
            <li key={user.id}>
              <Link
                href={`/u/${user.username}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.08]"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    url={user.avatar_url}
                    name={user.name}
                    username={user.username}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {user.name?.trim() || `@${user.username}`}
                    </p>
                    <p className="text-xs text-white/45">@{user.username}</p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-[0.14em] text-white/35">
                  View
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 ? (
        <p className="mt-2 text-xs text-white/45">No users found.</p>
      ) : null}
    </div>
  );
}
