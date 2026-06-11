"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Lock, MapPin, Moon, Smartphone, UserCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/types";

type SettingsProfile = Pick<
  Profile,
  "username" | "gender" | "notify_unverified_checkin" | "notify_rest_day" | "notify_cycle_share"
>;
import { GymsSection } from "./gyms-section";
import { DeleteAccountButton } from "./delete-account";
import { PushPermissionPrompt } from "@/components/push-permission";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";

type Gym = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_m: number;
};

type PeriodShare = {
  ownerId: string;
  ownerUsername: string | null;
  ownerName: string | null;
  notifyApproaching: boolean;
};

export function SettingsForm({
  profile,
  initialGyms,
  sharesWithMe = [],
}: {
  profile: SettingsProfile;
  initialGyms: Gym[];
  sharesWithMe?: PeriodShare[];
}) {
  return (
    <div className="space-y-6">
      {/* Profile link row */}
      <Link
        href={`/u/${profile.username}`}
        className="flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm transition hover:bg-white/[0.06]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
            <UserCircle className="h-[18px] w-[18px] text-white/60" />
          </div>
          <div>
            <p className="font-medium text-white">Your profile</p>
            <p className="mt-0.5 text-xs text-white/50">Name, photo, gender, weekly goal, rest days</p>
          </div>
        </div>
        <span className="text-white/35">›</span>
      </Link>

      <SectionHeader title="Gyms" icon={MapPin} />
      <GymsSection initialGyms={initialGyms} />

      <SectionHeader title="iOS Shortcuts" icon={Smartphone} />
      <Link
        href="/shortcut"
        className="flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm transition hover:bg-white/[0.06]"
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

      <SectionHeader title="Notifications" icon={Bell} />
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
        <NotifyToggle
          field="notify_cycle_share"
          label="Cycle data shared with you"
          description="Get notified when someone grants you access to their cycle data."
          initial={profile.notify_cycle_share ?? true}
        />
      </div>

      {sharesWithMe.length > 0 ? (
        <>
          <SectionHeader title="Period reminders" icon={Moon} />
          <div className="space-y-3">
            {sharesWithMe.map((share) => {
              const display =
                share.ownerName?.trim() ||
                (share.ownerUsername ? `@${share.ownerUsername}` : "Someone");
              return (
                <PeriodReminderToggle
                  key={share.ownerId}
                  ownerId={share.ownerId}
                  label={display}
                  initial={share.notifyApproaching}
                />
              );
            })}
          </div>
        </>
      ) : null}

      <SectionHeader title="Account" icon={Lock} />
      <ChangePasswordButton />

      {profile.username ? (
        <div className="rounded-[1.4rem] border border-red-900/40 bg-red-950/20 p-4 space-y-2">
          <p className="text-sm font-medium text-red-400">Delete account</p>
          <p className="text-xs text-red-400/70">
            Permanently removes your profile, check-ins, challenges, and obligations. Owned challenges hand off to the next member.
          </p>
          <DeleteAccountButton username={profile.username} />
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon?: LucideIcon }) {
  return (
    <div className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-white/45">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {title}
      </p>
    </div>
  );
}

function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setNewPassword("");
    setConfirm("");
    setErr(null);
    setSuccess(false);
    setBusy(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (newPassword.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setErr("Passwords don't match.");
      return;
    }

    setBusy(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setSuccess(true);
    setNewPassword("");
    setConfirm("");
    // Auto-close after 2 seconds
    window.setTimeout(close, 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm transition hover:bg-white/[0.06]"
      >
        <div>
          <p className="font-medium text-white">Change password</p>
          <p className="mt-0.5 text-xs text-white/50">Update your account password.</p>
        </div>
        <span className="text-white/35">›</span>
      </button>

      {open ? (
        <div
          className="animate-overlay-in fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-xl sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) close();
          }}
        >
          <div
            className="animate-sheet-in w-full max-w-md rounded-t-[2rem] border border-white/15 bg-[#0a0a0a] p-5 sm:rounded-[2rem]"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-white">Change password</p>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="text-xs text-white/55 hover:text-white"
              >
                Cancel
              </button>
            </div>

            {success ? (
              <p className="py-4 text-center text-sm text-white/80">
                Password updated successfully.
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={busy}
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={busy}
                    placeholder="Repeat new password"
                  />
                </div>
                {err ? <p className="text-sm text-destructive">{err}</p> : null}
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full"
                >
                  {busy ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function NotifyToggle({
  field,
  label,
  description,
  initial,
}: {
  field: "notify_unverified_checkin" | "notify_rest_day" | "notify_cycle_share" | "notify_partner_period";
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
    <div className="flex items-start justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
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

function PeriodReminderToggle({
  ownerId,
  label,
  initial,
}: {
  ownerId: string;
  label: string;
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
    const res = await fetch("/api/cycle/sharing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner_id: ownerId, notify_approaching: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setEnabled(prev);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs text-white/55">
          Remind me 2 days before {label}&apos;s predicted period.
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
  );
}
