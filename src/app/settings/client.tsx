"use client";

import { useMemo, useState, useTransition } from "react";
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
import { PeriodSyncCard } from "./period-sync";

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
  webhookSecret,
}: {
  profile: Profile;
  initialGyms: Gym[];
  webhookSecret: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    timezone: canonicalTimeZoneName(
      normalizeTimeZone(profile.timezone || DEFAULT_TIME_ZONE)
    ),
    gender: (profile.gender as string) ?? "",
    weekly_goal: (profile.weekly_goal ?? 4).toString(),
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
      weekly_goal: Math.min(7, Math.max(1, Number(form.weekly_goal) || 4)),
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
        .
      </p>
      <SectionHeader title="Schedule" />
      <div className="space-y-4">
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
        <div className="space-y-2">
          <Label>Weekly gym goal</Label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set("weekly_goal", n.toString())}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition ${
                  form.weekly_goal === n.toString()
                    ? "bg-white text-black"
                    : "border border-white/20 bg-white/8 text-white/60 hover:bg-white/15"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Days per week you aim to check in. Penalties apply when you fall short.
          </p>
        </div>
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

      <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-white/55 transition hover:text-white">
          <span>Advanced</span>
          <span className="text-white/45 group-open:hidden">Show</span>
          <span className="hidden text-white/45 group-open:inline">Hide</span>
        </summary>
        <div className="space-y-5 border-t border-white/8 p-4">
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
              Only used to show the period-day excuse option.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Webhook secret</Label>
            <p className="text-xs text-muted-foreground">
              Authenticates the iOS Shortcut. Rotate if it ever leaks.
            </p>
            <ShortcutSecret userId={profile.id} secret={webhookSecret} />
          </div>
          <div className="space-y-3 border-t border-white/8 pt-4">
            <Label>Notifications</Label>
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
          {profile.gender === "female" ? (
            <div className="space-y-2 border-t border-white/8 pt-4">
              <Label>Period sync</Label>
              <PeriodSyncCard
                initialEnabled={Boolean(profile.period_sync_enabled)}
                initialLastSyncedAt={profile.period_last_synced_at ?? null}
              />
            </div>
          ) : null}
          <div className="space-y-2 border-t border-white/8 pt-4">
            <Label>Danger zone</Label>
            <p className="text-xs text-white/55">
              Permanently delete your account, profile, check-ins, and any settled obligations. Owned challenges hand off to an admin or the oldest other member.
            </p>
            {profile.username ? (
              <DeleteAccountButton username={profile.username} />
            ) : null}
          </div>
        </div>
      </details>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {msg ? <p className="text-sm text-success">{msg}</p> : null}
      <Button
        type="submit"
        disabled={busy}
        className="w-full rounded-full"
      >
        {busy ? "Saving…" : "Save changes"}
      </Button>
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

export function ShortcutSecret({
  userId,
  secret,
}: {
  userId: string;
  secret: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);

  async function rotate() {
    if (!confirm("Rotate webhook secret? Your existing Shortcut will stop working.")) return;
    setBusy(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rotate_secret: true }),
    });
    setBusy(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="text-muted-foreground">User ID:</span>{" "}
        <span className="font-mono">{userId}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Secret:</span>
        <span className="font-mono break-all">
          {shown ? secret : "•".repeat(Math.min(secret.length, 16))}
        </span>
        <button
          className="text-xs underline"
          onClick={() => setShown((s) => !s)}
        >
          {shown ? "hide" : "show"}
        </button>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret);
            } catch {
              /* ignore */
            }
          }}
        >
          Copy secret
        </Button>
        <Button size="sm" variant="destructive" className="rounded-full" onClick={rotate} disabled={busy}>
          {busy ? "…" : "Rotate"}
        </Button>
      </div>
    </div>
  );
}
