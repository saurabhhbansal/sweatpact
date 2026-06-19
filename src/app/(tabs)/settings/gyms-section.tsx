"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Gym = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_m: number;
};

type Prediction = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
};

export function GymsSection({ initialGyms }: { initialGyms: Gym[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [gyms, setGyms] = useState<Gym[]>(initialGyms);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function updateRadius(gym: Gym, value: string) {
    const radius = Math.max(20, Math.min(5000, Number(value) || gym.radius_m));
    if (radius === gym.radius_m) return;
    setBusyId(gym.id);
    setErr(null);
    const res = await fetch(`/api/gyms/${gym.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ radius_m: radius }),
    });
    setBusyId(null);
    if (!res.ok) {
      setErr("Failed to update radius.");
      return;
    }
    setGyms((current) =>
      current.map((g) => (g.id === gym.id ? { ...g, radius_m: radius } : g))
    );
    refresh();
  }

  async function removeGym(gym: Gym) {
    if (!confirm(`Remove ${gym.name}?`)) return;
    setBusyId(gym.id);
    setErr(null);
    const res = await fetch(`/api/gyms/${gym.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setErr("Failed to delete gym.");
      return;
    }
    setGyms((current) => current.filter((g) => g.id !== gym.id));
    refresh();
  }

  function handleAdded(gym: Gym) {
    setGyms((current) => [...current, gym]);
    setAdding(false);
    refresh();
  }

  return (
    <div className="space-y-3">
      {gyms.length === 0 && !adding ? (
        <p className="text-xs text-white/55">
          Add at least one gym to enable verified check-ins.
        </p>
      ) : null}

      {gyms.map((gym) => (
        <div
          key={gym.id}
          className="rounded-[1.4rem] glass-card p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                <MapPin className="h-3.5 w-3.5 text-white/60" />
                <span className="truncate">{gym.name}</span>
              </p>
              {gym.address ? (
                <p className="mt-0.5 truncate text-xs text-white/45">{gym.address}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => removeGym(gym)}
              disabled={busyId === gym.id}
              aria-label="Remove gym"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Label htmlFor={`radius-${gym.id}`} className="text-xs text-white/55">
              Radius (m)
            </Label>
            <Input
              id={`radius-${gym.id}`}
              type="number"
              min={20}
              max={5000}
              defaultValue={gym.radius_m}
              onBlur={(e) => updateRadius(gym, e.target.value)}
              className="h-8 w-24"
              disabled={busyId === gym.id}
            />
          </div>
        </div>
      ))}

      {adding ? (
        <AddGymForm onAdded={handleAdded} onCancel={() => setAdding(false)} />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          className="w-full rounded-full"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {gyms.length === 0 ? "Add a gym" : "Add another gym"}
        </Button>
      )}

      {err ? <p className="text-xs text-white/85">{err}</p> : null}
    </div>
  );
}

function AddGymForm({
  onAdded,
  onCancel,
}: {
  onAdded: (gym: Gym) => void;
  onCancel: () => void;
}) {
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
              ? "Search is unavailable — Google Maps billing isn't enabled for this project. Use “Use my current location” for now."
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
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function chooseResult(p: Prediction) {
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
        body: JSON.stringify({
          name,
          address,
          lat: details.lat,
          lng: details.lng,
          radius_m: 50,
        }),
      });
      const data = await addRes.json().catch(() => ({}));
      if (!addRes.ok) {
        setErr(data.error ?? "Failed to add gym.");
        return;
      }
      onAdded(data.gym);
    } catch {
      setErr("Failed to add gym.");
    } finally {
      setBusy(false);
    }
  }

  async function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Geolocation not available.");
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
            name: "Current location",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            radius_m: 50,
          }),
        });
        const data = await addRes.json().catch(() => ({}));
        setBusy(false);
        if (!addRes.ok) {
          setErr(data.error ?? "Failed to add gym.");
          return;
        }
        onAdded(data.gym);
      },
      (e) => {
        setBusy(false);
        setErr(e.message);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="space-y-2 rounded-[1.4rem] glass-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Add a gym</p>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Cancel"
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
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
                onClick={() => chooseResult(r)}
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={useCurrentLocation}
        disabled={busy}
        className="w-full"
      >
        Use my current location
      </Button>
      {err ? <p className="text-xs text-white/85">{err}</p> : null}
      <p className="text-xs text-white/40">Powered by Google Maps</p>
    </div>
  );
}
