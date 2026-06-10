"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Prediction = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
};

export function GymOnboarding({ initialGymCount }: { initialGymCount: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [count, setCount] = useState(initialGymCount);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchErr(null);
      return;
    }
    setSearching(true);
    setSearchErr(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) {
          setResults([]);
          setSearchErr(
            data.error === "places_api_error"
              ? "Search is unavailable right now. Use “Use my current location” for now."
              : data.error === "maps_not_configured"
                ? "Search isn't configured. Use “Use my current location”."
                : "Search failed. Try again."
          );
          return;
        }
        setResults(data.predictions ?? []);
      } catch {
        setResults([]);
        setSearchErr("Search failed. Try again.");
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function pick(p: Prediction) {
    setBusy(true);
    setErr(null);
    try {
      const detailsRes = await fetch(`/api/places/details?place_id=${p.place_id}`);
      const details = await detailsRes.json();
      const name = (details.name as string | undefined) || p.main_text;
      const address = (details.address as string | undefined) || p.secondary_text || null;
      const addRes = await fetch("/api/gyms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, address, lat: details.lat, lng: details.lng, radius_m: 150 }),
      });
      const data = await addRes.json().catch(() => ({}));
      if (!addRes.ok) {
        setErr(data.error ?? "Failed to add gym.");
        return;
      }
      setCount((c) => c + 1);
      setQuery("");
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  async function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Geolocation isn't available.");
      return;
    }
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const addRes = await fetch("/api/gyms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "My gym",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            radius_m: 150,
          }),
        });
        const data = await addRes.json().catch(() => ({}));
        setBusy(false);
        if (!addRes.ok) {
          setErr(data.error ?? "Failed to add gym.");
          return;
        }
        setCount((c) => c + 1);
      },
      (e) => {
        setBusy(false);
        setErr(e.message);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  function next() {
    startTransition(() => router.push("/onboarding/shortcut"));
  }

  return (
    <div className="space-y-4">
      {count > 0 ? (
        <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3 text-center">
          <p className="text-sm font-medium text-white">
            {count} gym{count === 1 ? "" : "s"} added.
          </p>
          <p className="mt-1 text-xs text-white/55">
            You can add more from Settings later.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Input
          placeholder="Search for your gym or address…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          disabled={busy}
        />
        {searching ? (
          <p className="text-xs text-white/45">Searching…</p>
        ) : searchErr ? (
          <p className="text-xs text-white/85">{searchErr}</p>
        ) : results.length > 0 ? (
          <ul className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/15 bg-[#0a0a0a]">
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  disabled={busy}
                  className="block w-full px-3 py-2.5 text-left transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-white/90">{r.main_text}</p>
                  <p className="text-xs text-white/45">{r.secondary_text}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={useCurrentLocation}
        disabled={busy}
        className="w-full rounded-full"
      >
        Use my current location
      </Button>

      {err ? <p className="text-xs text-white/85">{err}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={next}
          disabled={busy}
          className="text-sm text-white/55 underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
        <Button
          type="button"
          onClick={next}
          disabled={busy}
          className="ml-auto rounded-full"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
