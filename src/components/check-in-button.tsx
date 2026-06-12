"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CheckinResponse = {
  ok?: boolean;
  action?: "created" | "updated" | "existing";
  verified?: boolean;
  distance_m?: number | null;
  error?: string;
};

export function CheckInButton({
  onOptimistic,
  periodDayMode = false,
  compact = false,
}: {
  onOptimistic?: (status: "verified" | "unverified") => void;
  // When true, shows a period-specific congratulation message on success.
  periodDayMode?: boolean;
  // When true, renders a circular tick button instead of the full-width text
  // button. Must be placed directly inside a `flex flex-wrap` row: messages and
  // the unverified-confirm panel use `basis-full` to wrap onto their own line.
  compact?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [pendingUnverified, setPendingUnverified] = useState<{
    lat?: number;
    lng?: number;
    distance?: number | null;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getLocation(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
      );
    });
  }

  async function send(lat?: number, lng?: number, allowUnverified = false) {
    setBusy(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        source: "manual",
        allow_unverified: allowUnverified,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as CheckinResponse;
    setBusy(false);

    if (!res.ok) {
      if (data.error === "location_outside_radius") {
        setPendingUnverified({ lat, lng, distance: data.distance_m });
        return;
      }
      if (data.error === "already_checked_in") {
        setMessage("You already have a valid check-in for today.");
        return;
      }
      setError(data.error ?? "Check-in failed");
      return;
    }

    setPendingUnverified(null);
    setMessage(
      periodDayMode
        ? data.verified
          ? "You showed up on your period. That is seriously impressive."
          : data.action === "existing"
            ? "Your unverified check-in is already on the board."
            : "Logged as unverified — incredible that you showed up on your period."
        : data.verified
          ? data.action === "updated"
            ? "Your earlier unverified check-in is now verified."
            : "Checked in and verified."
          : data.action === "existing"
            ? "Your unverified check-in is already on the board."
            : "Saved as unverified. It counts now, but whoever runs your challenge can reverse it."
    );
    if (data.verified !== undefined) {
      onOptimistic?.(data.verified ? "verified" : "unverified");
    }
    startTransition(() => router.refresh());
  }

  async function onPrimary() {
    setMessage(null);
    setError(null);
    const position = await getLocation();
    await send(position?.coords.latitude, position?.coords.longitude, false);
  }

  if (pendingUnverified) {
    const distanceLabel =
      pendingUnverified.distance != null
        ? `${Math.round(pendingUnverified.distance)} m`
        : "unknown distance";

    return (
      <div className={`animate-state-in space-y-3${compact ? " basis-full" : ""}`}>
        <p className="rounded-[1.2rem] border border-white/20 bg-white/[0.04] p-3 text-sm text-white/80">
          You&apos;re outside your gym radius ({distanceLabel}). Submit anyway as an unverified
          check-in? It counts immediately, but whoever runs your challenge can reverse it.
        </p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="secondary"
            disabled={busy}
            onClick={() => send(pendingUnverified.lat, pendingUnverified.lng, true)}
          >
            {busy ? "Sending..." : "Submit unverified"}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setPendingUnverified(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const feedback = (
    <>
      {message ? <p role="status" aria-live="polite" className={`animate-menu-in text-sm text-success${compact ? " basis-full" : ""}`}>{message}</p> : null}
      {error ? <p role="alert" aria-live="assertive" className={`animate-menu-in text-sm text-destructive${compact ? " basis-full" : ""}`}>{error}</p> : null}
    </>
  );

  if (compact) {
    return (
      <>
        <Button
          size="icon"
          className="h-12 w-12 shrink-0"
          aria-label={busy ? "Checking in..." : "Check in now"}
          aria-busy={busy}
          onClick={onPrimary}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        </Button>
        {feedback}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full text-base" onClick={onPrimary} disabled={busy}>
        {busy ? "Checking in..." : periodDayMode ? "Hit the gym anyway" : "Check in now"}
      </Button>
      {feedback}
    </div>
  );
}
