"use client";

import { useState } from "react";
import { Check, Copy, Download, Eye, EyeOff } from "lucide-react";

// ─── CopyField ────────────────────────────────────────────────────────────────

export function CopyField({
  label,
  value,
  hidden = false,
}: {
  label: string;
  value: string;
  hidden?: boolean;
}) {
  const [shown, setShown] = useState(!hidden);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-[0.16em] text-white/55">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2">
        <span className="flex-1 truncate font-mono text-xs text-white/90">
          {shown ? value : "•".repeat(Math.min(value.length, 16))}
        </span>
        {hidden ? (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide" : "Show"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white"
          >
            {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={copy}
          aria-label="Copy"
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── ScreenshotSlot ───────────────────────────────────────────────────────────
// Placeholder that makes it easy to drop in a real screenshot later.
// Replace the whole element with <img src="..." alt="..." className="..."> or
// <video> when you have the actual recording.

export function ScreenshotSlot({ label }: { label: string }) {
  return (
    <div className="flex min-h-[7rem] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-5 text-center">
      <p className="text-xs text-white/35">{label}</p>
    </div>
  );
}

// ─── Step ─────────────────────────────────────────────────────────────────────

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black">
        {number}
      </div>
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <p className="text-sm font-semibold text-white">{title}</p>
        {children}
      </div>
    </div>
  );
}

// ─── ShortcutSetup ────────────────────────────────────────────────────────────

const GYM_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/e8ad937c480b4a4ea5f34dd4d8475b71";
const PERIOD_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/41571ae1c985413fbd09facd41786706";

export function ShortcutSetup({
  userId,
  webhookSecret,
  isFemale,
}: {
  userId: string;
  webhookSecret: string;
  isFemale: boolean;
}) {
  const [tab, setTab] = useState<"gym" | "period">("gym");

  return (
    <div className="space-y-6">
      {/* Tab switcher — only shown for female users */}
      {isFemale ? (
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/12 bg-white/[0.04] p-1">
          {(["gym", "period"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-[1.2rem] py-2 text-sm font-medium transition ${
                tab === t
                  ? "bg-white text-black"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {t === "gym" ? "Gym Check-in" : "Period Sync"}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "gym" ? (
        <GymShortcutSteps userId={userId} webhookSecret={webhookSecret} />
      ) : (
        <PeriodShortcutSteps userId={userId} webhookSecret={webhookSecret} />
      )}
    </div>
  );
}

// ─── Gym shortcut steps ───────────────────────────────────────────────────────

function GymShortcutSteps({
  userId,
  webhookSecret,
}: {
  userId: string;
  webhookSecret: string;
}) {
  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <p className="text-lg font-semibold text-white">Gym Check-in Shortcut</p>
        <p className="text-sm text-white/55">
          Automatically logs a GPS-verified check-in when you arrive at your gym.
          iPhone only.
        </p>
      </div>

      <div className="space-y-1.5 rounded-2xl border border-white/15 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-white/45">
          Your credentials
        </p>
        <p className="text-xs text-white/50">
          Copy these before you tap Install — the Shortcut will ask for them on first run.
        </p>
        <div className="mt-3 space-y-3">
          <CopyField label="User ID" value={userId} />
          <CopyField label="Secret Key" value={webhookSecret} hidden />
        </div>
      </div>

      <div className="space-y-6">
        <Step number={1} title="Allow untrusted shortcuts (first time only)">
          <p className="text-sm text-white/65">
            Open the iPhone <strong>Settings</strong> app → scroll to{" "}
            <strong>Shortcuts</strong> → turn on{" "}
            <strong>Allow Untrusted Shortcuts</strong>. You only need to do this
            once.
          </p>
          <ScreenshotSlot label="Screenshot: Settings → Shortcuts → Allow Untrusted Shortcuts" />
        </Step>

        <Step number={2} title="Install the Shortcut">
          <p className="text-sm text-white/65">
            Tap the button below. Safari opens a preview sheet — tap{" "}
            <strong>Add Shortcut</strong>. When it asks for your User ID and Secret
            Key, paste them from the credentials box above.
          </p>
          <a
            href={GYM_SHORTCUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <Download className="h-4 w-4" />
            Install Gym Check-in Shortcut
          </a>
          <ScreenshotSlot label="Screenshot: Shortcut install sheet with Add Shortcut button" />
        </Step>

        <Step number={3} title="Open the Shortcuts app and go to Automation">
          <p className="text-sm text-white/65">
            Open the <strong>Shortcuts</strong> app → tap the{" "}
            <strong>Automation</strong> tab at the bottom → tap the{" "}
            <strong>+</strong> button at the top right.
          </p>
          <ScreenshotSlot label="Screenshot: Shortcuts app Automation tab with + button" />
        </Step>

        <Step number={4} title="Create an Arrive automation">
          <p className="text-sm text-white/65">
            Tap <strong>New Automation</strong> → scroll to and tap{" "}
            <strong>Arrive</strong>. Tap <strong>Choose</strong> under Location
            and search for your gym. Set the radius to something small like 100m
            so it only fires when you actually walk in.
          </p>
          <ScreenshotSlot label="Screenshot: Arrive automation with gym location set" />
        </Step>

        <Step number={5} title="Add the SweatPact action">
          <p className="text-sm text-white/65">
            Tap <strong>Next</strong> → tap <strong>Add Action</strong> → search
            for <strong>SweatPact</strong> → select{" "}
            <strong>SweatPact Check In</strong>.
          </p>
          <ScreenshotSlot label="Screenshot: Add Action search showing SweatPact Check In" />
        </Step>

        <Step number={6} title="Turn off Ask Before Running">
          <p className="text-sm text-white/65">
            Tap <strong>Next</strong>. Toggle off{" "}
            <strong>Ask Before Running</strong> — tap{" "}
            <strong>Don't Ask</strong> when prompted. This makes it fire silently
            when you arrive. Tap <strong>Done</strong>.
          </p>
          <ScreenshotSlot label="Screenshot: Ask Before Running toggle turned off" />
        </Step>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/55">
        <p className="font-semibold text-white/80">If the automation doesn't fire</p>
        <p>
          Apple sometimes drops location automations. If that happens, use the{" "}
          <strong>Check in now</strong> button on the dashboard — an
          outside-radius attempt goes through as unverified so your challenge
          partners can review it.
        </p>
        <p className="font-semibold text-white/80">Security</p>
        <p>
          The Secret Key is what proves it is you. Anyone with it can check in as
          you. If it ever leaks, go to <strong>Settings → Advanced → Rotate secret</strong>.
        </p>
      </div>
    </div>
  );
}

// ─── Period sync shortcut steps ───────────────────────────────────────────────

function PeriodShortcutSteps({
  userId,
  webhookSecret,
}: {
  userId: string;
  webhookSecret: string;
}) {
  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <p className="text-lg font-semibold text-white">Period Sync Shortcut</p>
        <p className="text-sm text-white/55">
          Runs once a day and pulls your menstrual flow data from Apple Health.
          Period days are automatically marked as excused — no manual logging
          needed.
        </p>
      </div>

      <div className="space-y-1.5 rounded-2xl border border-white/15 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-white/45">
          Your credentials
        </p>
        <p className="text-xs text-white/50">
          Same credentials as the Gym Shortcut — copy before tapping Install.
        </p>
        <div className="mt-3 space-y-3">
          <CopyField label="User ID" value={userId} />
          <CopyField label="Secret Key" value={webhookSecret} hidden />
        </div>
      </div>

      <div className="space-y-6">
        <Step number={1} title="Enable Period Sync in Settings">
          <p className="text-sm text-white/65">
            Go to <strong>Settings → Period sync</strong> and turn it on. This
            authorises your account to receive health data from the Shortcut.
          </p>
          <ScreenshotSlot label="Screenshot: Settings page with Period sync toggle turned on" />
        </Step>

        <Step number={2} title="Install the Shortcut">
          <p className="text-sm text-white/65">
            Tap the button below → tap <strong>Add Shortcut</strong> in the
            sheet → paste your User ID and Secret Key when prompted.
          </p>
          <a
            href={PERIOD_SHORTCUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <Download className="h-4 w-4" />
            Install Period Sync Shortcut
          </a>
          <ScreenshotSlot label="Screenshot: Period Sync shortcut install sheet" />
        </Step>

        <Step number={3} title="Open the Shortcuts app and go to Automation">
          <p className="text-sm text-white/65">
            Open the <strong>Shortcuts</strong> app → tap the{" "}
            <strong>Automation</strong> tab → tap <strong>+</strong>.
          </p>
          <ScreenshotSlot label="Screenshot: Shortcuts Automation tab" />
        </Step>

        <Step number={4} title="Create a daily Time of Day automation">
          <p className="text-sm text-white/65">
            Tap <strong>New Automation</strong> → <strong>Time of Day</strong>.
            Set a time you are reliably awake with your phone nearby (e.g.{" "}
            <strong>07:00</strong>). Set <strong>Repeat</strong> to{" "}
            <strong>Daily</strong>. Tap <strong>Next</strong>.
          </p>
          <ScreenshotSlot label="Screenshot: Time of Day automation set to 07:00 Daily" />
        </Step>

        <Step number={5} title="Add the SweatPact Period Sync action">
          <p className="text-sm text-white/65">
            Tap <strong>Add Action</strong> → search{" "}
            <strong>SweatPact</strong> → select{" "}
            <strong>SweatPact Period Sync</strong>.
          </p>
          <ScreenshotSlot label="Screenshot: Add Action showing SweatPact Period Sync" />
        </Step>

        <Step number={6} title="Turn off Ask Before Running">
          <p className="text-sm text-white/65">
            Tap <strong>Next</strong> → toggle off{" "}
            <strong>Ask Before Running</strong> → tap{" "}
            <strong>Don't Ask</strong> → tap <strong>Done</strong>. The sync
            will now run silently every morning.
          </p>
          <ScreenshotSlot label="Screenshot: Ask Before Running turned off" />
        </Step>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/55">
        <p className="font-semibold text-white/80">What it syncs</p>
        <p className="mt-1">
          The Shortcut reads the last 60 days of menstrual flow entries from
          Apple Health and sends them to SweatPact. Days that already have a
          gym check-in are left untouched — it never overwrites real attendance.
        </p>
      </div>
    </div>
  );
}
