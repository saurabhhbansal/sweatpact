"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTimeZones } from "@vvo/tzdb";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEFAULT_TIME_ZONE, normalizeTimeZone } from "@/lib/time";
import type { Profile } from "@/lib/types";
import { GymsSection } from "./gyms-section";
import { DeleteAccountButton } from "./delete-account";
import { PushPermissionPrompt } from "@/components/push-permission";

type Gym = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_m: number;
};

const TIME_ZONE_ALIAS_MAP: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
};

function canonicalTimeZoneName(name: string): string {
  return TIME_ZONE_ALIAS_MAP[name] ?? name;
}

function getAvailableTimeZones(): string[] {
  try {
    const zones = getTimeZones().map((z) => canonicalTimeZoneName(z.name));
    if (zones.length > 0) {
      const unique = Array.from(new Set([DEFAULT_TIME_ZONE, ...zones]));
      return unique.sort((a, b) => {
        if (a === DEFAULT_TIME_ZONE) return -1;
        if (b === DEFAULT_TIME_ZONE) return 1;
        return a.localeCompare(b);
      });
    }
  } catch {
    // Fallback list below.
  }

  return [
    DEFAULT_TIME_ZONE,
    "UTC",
    "Asia/Dubai",
    "Asia/Singapore",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Australia/Sydney",
  ];
}

export function SettingsForm({
  profile,
  initialGyms,
}: {
  profile: Profile;
  initialGyms: Gym[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    timezone: canonicalTimeZoneName(
      normalizeTimeZone(profile.timezone || DEFAULT_TIME_ZONE)
    ),
    gender: (profile.gender as string) ?? "",
  });
  const timezones = useMemo(() => {
    const zones = getAvailableTimeZones();
    if (!zones.includes(form.timezone)) {
      return [form.timezone, ...zones];
    }
    return zones;
  }, [form.timezone]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const body: Record<string, unknown> = {
      timezone: form.timezone,
    };
    if (form.gender) body.gender = form.gender;
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      return;
    }
    setMsg("Saved.");
    startTransition(() => router.refresh());
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <p className="text-xs text-white/45">
        Name, username, photo and visibility are managed on your{" "}
        <Link href={`/u/${profile.username}`} className="underline text-white/65 hover:text-white">
          profile
        </Link>
        . Weekly goal and rest days are also on your profile.
      </p>

      <SectionHeader title="Schedule" />
      <div className="space-y-1.5">
        <Label htmlFor="tz">Timezone</Label>
        <select
          id="tz"
          className="flex h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm"
          value={form.timezone}
          onChange={(e) => set("timezone", e.target.value)}
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Default is IST ({DEFAULT_TIME_ZONE}).
        </p>
      </div>

      <SectionHeader title="Gyms" />
      <GymsSection initialGyms={initialGyms} />

      <SectionHeader title="iOS Shortcuts" />
      <Link
        href="/shortcut"
        className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/[0.02] px-4 py-3.5 text-sm transition hover:bg-white/[0.05]"
      >
        <div>
          <p className="font-medium text-white">Shortcut setup guide</p>
          <p className="mt-0.5 text-xs text-white/50">
            {profile.gender === "female"
              ? "Gym check-in and Period sync automations"
              : "Auto check-in when you arrive at the gym"}
          </p>
        </div>
        <span className="text-white/35">›</span>
      </Link>

      <SectionHeader title="Notifications" />
      <div className="space-y-3">
        <PushPermissionPrompt />
        <NotifyToggle
          field="notify_unverified_checkin"
          label="Share unverified check-ins"
          description="Let your challenge members know when you log a check-in outside your gym radius."
          initial={profile.notify_unverified_checkin ?? true}
        />
        <NotifyToggle
          field="notify_rest_day"
          label="Share rest days"
          description="Let your challenge members know when you take a rest day."
          initial={profile.notify_rest_day ?? true}
        />
      </div>

      <SectionHeader title="Profile" />
      <div className="space-y-1.5">
        <Label htmlFor="gender">Gender</Label>
        <select
          id="gender"
          className="flex h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm"
          value={form.gender}
          onChange={(e) => set("gender", e.target.value)}
        >
          <option value="" disabled>Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Used to show the period-day excuse option and Cycle tab.
        </p>
      </div>

      {profile.gender === "female" ? (
        <>
          <SectionHeader title="Period sync" />
          <PeriodSyncToggle
            initialEnabled={Boolean(profile.period_sync_enabled)}
            initialLastSyncedAt={profile.period_last_synced_at ?? null}
          />
        </>
      ) : null}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {msg ? <p className="text-sm text-success">{msg}</p> : null}
      <Button
        type="submit"
        disabled={busy}
        className="w-full rounded-full"
      >
        {busy ? "Saving…" : "Save changes"}
      </Button>

      {profile.username ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-4 space-y-2">
          <p className="text-sm font-medium text-red-400">Delete account</p>
          <p className="text-xs text-red-400/70">
            Permanently removes your profile, check-ins, challenges, and obligations. Owned challenges hand off to the next member.
          </p>
          <DeleteAccountButton username={profile.username} />
        </div>
      ) : null}
    </form>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-t border-white/8 pt-4 first:border-t-0 first:pt-0">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">{title}</p>
    </div>
  );
}

function NotifyToggle({
  field,
  label,
  description,
  initial,
}: {
  field: "notify_unverified_checkin" | "notify_rest_day";
  label: string;
  description: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    if (busy) return;
    const prev = enabled;
    setEnabled(next);
    setBusy(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setEnabled(prev);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.02] p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs text-white/55">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => toggle(!enabled)}
        disabled={busy}
        aria-pressed={enabled}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
          enabled ? "border-white bg-white" : "border-white/25 bg-white/[0.06]"
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full transition ${
            enabled ? "translate-x-6 bg-black" : "translate-x-1 bg-white/70"
          }`}
        />
      </button>
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PeriodSyncToggle({
  initialEnabled,
  initialLastSyncedAt,
}: {
  initialEnabled: boolean;
  initialLastSyncedAt: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pendingRef = useRef(false);

  async function toggle(next: boolean) {
    if (busy) return;
    pendingRef.current = true;
    const prev = enabled;
    setEnabled(next);
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ period_sync_enabled: next }),
    });
    setBusy(false);
    pendingRef.current = false;
    if (!res.ok) {
      setEnabled(prev);
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.02] p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Sync from Apple Health</p>
          <p className="mt-0.5 text-xs text-white/55">
            {enabled
              ? `Last synced: ${timeAgo(initialLastSyncedAt)}`
              : "Period days auto-marked as excused via iOS Shortcut."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggle(!enabled)}
          disabled={busy}
          aria-pressed={enabled}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
            enabled ? "border-white bg-white" : "border-white/25 bg-white/[0.06]"
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full transition ${
              enabled ? "translate-x-6 bg-black" : "translate-x-1 bg-white/70"
            }`}
          />
        </button>
      </div>
      <Link href="/shortcut" className="block text-xs text-white/45 underline hover:text-white/70">
        Set up the iOS Shortcut →
      </Link>
      {err ? <p className="text-xs text-white/85">{err}</p> : null}
    </div>
  );
}
