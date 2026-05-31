"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, Download, Eye, EyeOff } from "lucide-react";

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

// ─── RotateSecretButton ───────────────────────────────────────────────────────

export function RotateSecretButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function rotate() {
    if (!confirm("Rotate webhook secret? Your existing Shortcut will stop working until you update it with the new secret.")) return;
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
    <button
      type="button"
      onClick={rotate}
      disabled={busy}
      className="rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
    >
      {busy ? "Rotating…" : "Rotate secret"}
    </button>
  );
}

// ─── PhoneFrame ───────────────────────────────────────────────────────────────

function PhoneFrame({
  src,
  alt,
  placeholder,
}: {
  src: string | null;
  alt: string;
  placeholder?: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto w-[220px] select-none">
      {/* Shell */}
      <div className="relative rounded-[3rem] border-[7px] border-white/15 bg-black shadow-2xl shadow-black/70 ring-1 ring-inset ring-white/[0.07]">
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-2.5 z-10 h-[17px] w-[76px] -translate-x-1/2 rounded-full bg-black" />
        {/* Screen */}
        <div className="overflow-hidden rounded-[2.5rem] bg-neutral-900">
          {src ? (
            <img src={src} alt={alt} className="w-full object-cover" draggable={false} />
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center px-5 py-10">
              {placeholder ?? (
                <p className="text-center text-[10px] leading-relaxed text-white/25">{alt}</p>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Side buttons */}
      <div className="absolute -left-[9px] top-[72px] h-7 w-[3px] rounded-full bg-white/15" />
      <div className="absolute -left-[9px] top-[108px] h-7 w-[3px] rounded-full bg-white/15" />
      <div className="absolute -right-[9px] top-[90px] h-10 w-[3px] rounded-full bg-white/15" />
    </div>
  );
}

// ─── Step data types ──────────────────────────────────────────────────────────

type StepAction =
  | { type: "credentials"; userId: string; webhookSecret: string }
  | { type: "gym-install" }
  | { type: "period-install" }
  | { type: "rotate" };

type WizardStep = {
  title: string;
  description: React.ReactNode;
  // Path relative to /public — null means no image yet (placeholder shown)
  screenshot: string | null;
  screenshotAlt: string;
  action?: StepAction;
};

// ─── Step definitions ─────────────────────────────────────────────────────────

const GYM_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/e8ad937c480b4a4ea5f34dd4d8475b71";
const PERIOD_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/41571ae1c985413fbd09facd41786706";

function gymSteps(userId: string, webhookSecret: string): WizardStep[] {
  return [
    {
      title: "Copy your credentials",
      description: (
        <>
          The Shortcut will ask for your <strong>User ID</strong> and{" "}
          <strong>Secret Key</strong> the first time it runs. Copy them now so
          they are ready to paste.
        </>
      ),
      screenshot: null,
      screenshotAlt: "Credentials ready to copy",
      action: { type: "credentials", userId, webhookSecret },
    },
    {
      title: "Allow untrusted shortcuts",
      description: (
        <>
          Open the iPhone <strong>Settings</strong> app, scroll down to{" "}
          <strong>Shortcuts</strong>, and turn on{" "}
          <strong>Allow Untrusted Shortcuts</strong>. You only need to do this
          once — Apple requires it before installing third-party shortcuts.
        </>
      ),
      screenshot: "/screenshots/gym-02-untrusted.png",
      screenshotAlt: "Settings app showing Allow Untrusted Shortcuts toggled on",
    },
    {
      title: "Install the Shortcut",
      description: (
        <>
          Tap the button below. Safari opens a preview sheet — tap{" "}
          <strong>Add Shortcut</strong>. When prompted, paste your User ID and
          Secret Key from step 1.
        </>
      ),
      screenshot: "/screenshots/gym-03-install.png",
      screenshotAlt: "Safari sheet showing Add Shortcut button for SweatPact Check In",
      action: { type: "gym-install" },
    },
    {
      title: "Open Shortcuts → Automation",
      description: (
        <>
          Open the <strong>Shortcuts</strong> app on your iPhone. Tap the{" "}
          <strong>Automation</strong> tab at the bottom of the screen, then tap
          the <strong>+</strong> button at the top right.
        </>
      ),
      screenshot: "/screenshots/gym-04-automation.png",
      screenshotAlt: "Shortcuts app on the Automation tab with + button highlighted",
    },
    {
      title: "Create an Arrive automation",
      description: (
        <>
          Tap <strong>New Automation</strong> → scroll to and tap{" "}
          <strong>Arrive</strong>. Tap <strong>Choose</strong> under Location,
          search for your gym, and select it. Set a tight radius — around{" "}
          <strong>100 m</strong> — so it only fires when you walk inside.
        </>
      ),
      screenshot: "/screenshots/gym-05-arrive.png",
      screenshotAlt: "Arrive automation with gym location and 100m radius set",
    },
    {
      title: "Add the SweatPact action",
      description: (
        <>
          Tap <strong>Next</strong>, then tap <strong>Add Action</strong>.
          Search for <strong>SweatPact</strong> and select{" "}
          <strong>SweatPact Check In</strong> from the results.
        </>
      ),
      screenshot: "/screenshots/gym-06-action.png",
      screenshotAlt: "Add Action search showing SweatPact Check In result",
    },
    {
      title: "Turn off Ask Before Running",
      description: (
        <>
          Tap <strong>Next</strong>. Toggle off{" "}
          <strong>Ask Before Running</strong> and tap{" "}
          <strong>Don&apos;t Ask</strong> when iOS prompts you. This lets the
          automation fire silently the moment you arrive. Tap{" "}
          <strong>Done</strong>.
        </>
      ),
      screenshot: "/screenshots/gym-07-silent.png",
      screenshotAlt: "Automation summary with Ask Before Running turned off",
    },
    {
      title: "All set",
      description: (
        <>
          The Shortcut will now automatically check you in whenever you arrive
          at your gym. If it ever stops firing, use the{" "}
          <strong>Check in now</strong> button on the dashboard as a fallback.
          If your Secret Key leaks, rotate it below.
        </>
      ),
      screenshot: null,
      screenshotAlt: "Setup complete",
      action: { type: "rotate" },
    },
  ];
}

function periodSteps(userId: string, webhookSecret: string): WizardStep[] {
  return [
    {
      title: "Copy your credentials",
      description: (
        <>
          The Period Sync Shortcut uses the same <strong>User ID</strong> and{" "}
          <strong>Secret Key</strong> as the gym check-in Shortcut. Copy them
          now so they are ready to paste on install.
        </>
      ),
      screenshot: null,
      screenshotAlt: "Credentials ready to copy",
      action: { type: "credentials", userId, webhookSecret },
    },
    {
      title: "Enable Period Sync in SweatPact",
      description: (
        <>
          Open <strong>SweatPact → Settings</strong> and toggle on{" "}
          <strong>Sync from Apple Health</strong> under the Period sync section.
          This authorises your account to accept health data from the Shortcut.
        </>
      ),
      screenshot: "/screenshots/period-02-settings.png",
      screenshotAlt: "SweatPact Settings showing Period Sync toggle turned on",
    },
    {
      title: "Install the Shortcut",
      description: (
        <>
          Tap the button below. Safari opens a preview — tap{" "}
          <strong>Add Shortcut</strong>. Paste your User ID and Secret Key when
          prompted.
        </>
      ),
      screenshot: "/screenshots/period-03-install.png",
      screenshotAlt: "Safari sheet showing Add Shortcut button for SweatPact Period Sync",
      action: { type: "period-install" },
    },
    {
      title: "Open Shortcuts → Automation",
      description: (
        <>
          Open the <strong>Shortcuts</strong> app, tap the{" "}
          <strong>Automation</strong> tab at the bottom, then tap the{" "}
          <strong>+</strong> button at the top right.
        </>
      ),
      screenshot: "/screenshots/gym-04-automation.png",
      screenshotAlt: "Shortcuts app on the Automation tab with + button highlighted",
    },
    {
      title: "Create a daily Time of Day automation",
      description: (
        <>
          Tap <strong>New Automation</strong> → <strong>Time of Day</strong>.
          Pick a time you are reliably awake with your phone nearby — e.g.{" "}
          <strong>07:00</strong>. Set <strong>Repeat</strong> to{" "}
          <strong>Daily</strong>. Tap <strong>Next</strong>.
        </>
      ),
      screenshot: "/screenshots/period-05-timeofday.png",
      screenshotAlt: "Time of Day automation set to 07:00 Daily",
    },
    {
      title: "Add the Period Sync action",
      description: (
        <>
          Tap <strong>Add Action</strong>, search for <strong>SweatPact</strong>
          , and select <strong>SweatPact Period Sync</strong> from the results.
        </>
      ),
      screenshot: "/screenshots/period-06-action.png",
      screenshotAlt: "Add Action search showing SweatPact Period Sync result",
    },
    {
      title: "Turn off Ask Before Running",
      description: (
        <>
          Tap <strong>Next</strong>, toggle off{" "}
          <strong>Ask Before Running</strong>, tap{" "}
          <strong>Don&apos;t Ask</strong>, then tap <strong>Done</strong>. The
          sync will now run silently every morning, pulling the last 60 days of
          flow data from Apple Health.
        </>
      ),
      screenshot: "/screenshots/gym-07-silent.png",
      screenshotAlt: "Automation summary with Ask Before Running turned off",
    },
  ];
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

function Wizard({
  steps,
  onDone,
}: {
  steps: WizardStep[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return (
    <div className="space-y-6">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5">
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`rounded-full transition-all ${
              i === index
                ? "h-2 w-6 bg-white"
                : i < index
                  ? "h-2 w-2 bg-white/50"
                  : "h-2 w-2 bg-white/20"
            }`}
          />
        ))}
      </div>

      {/* Step counter */}
      <p className="text-center text-xs uppercase tracking-[0.18em] text-white/40">
        Step {index + 1} of {steps.length}
      </p>

      {/* Title + description */}
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-white">{step.title}</h2>
        <p className="text-sm leading-relaxed text-white/65">{step.description}</p>
      </div>

      {/* Action above phone (install buttons) */}
      {step.action?.type === "gym-install" ? (
        <a
          href={GYM_SHORTCUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          <Download className="h-4 w-4" />
          Install Gym Check-in Shortcut
        </a>
      ) : step.action?.type === "period-install" ? (
        <a
          href={PERIOD_SHORTCUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          <Download className="h-4 w-4" />
          Install Period Sync Shortcut
        </a>
      ) : null}

      {/* Phone frame or credentials */}
      {step.action?.type === "credentials" ? (
        <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.02] p-4">
          <CopyField label="User ID" value={step.action.userId} />
          <CopyField label="Secret Key" value={step.action.webhookSecret} hidden />
        </div>
      ) : step.action?.type === "rotate" ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-white/70">Secret Key</p>
          <p className="text-xs text-white/45">
            Rotate it if it ever leaks. Your Shortcut will need to be
            reinstalled with the new secret.
          </p>
          <RotateSecretButton />
        </div>
      ) : (
        <PhoneFrame
          src={step.screenshot}
          alt={step.screenshotAlt}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => i - 1)}
          disabled={isFirst}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/50 transition hover:border-white/30 hover:text-white disabled:opacity-20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => (isLast ? onDone() : setIndex((i) => i + 1))}
          className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-sm font-semibold text-black transition hover:bg-white/90"
        >
          {isLast ? "Done" : "Continue"}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── ShortcutSetup ────────────────────────────────────────────────────────────

export function ShortcutSetup({
  userId,
  webhookSecret,
  isFemale,
}: {
  userId: string;
  webhookSecret: string;
  isFemale: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"gym" | "period">("gym");

  const steps =
    tab === "gym"
      ? gymSteps(userId, webhookSecret)
      : periodSteps(userId, webhookSecret);

  return (
    <div className="space-y-6">
      {isFemale ? (
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/12 bg-white/[0.04] p-1">
          {(["gym", "period"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-[1.2rem] py-2 text-sm font-medium transition ${
                tab === t ? "bg-white text-black" : "text-white/55 hover:text-white"
              }`}
            >
              {t === "gym" ? "Gym Check-in" : "Period Sync"}
            </button>
          ))}
        </div>
      ) : null}

      <Wizard
        key={tab}
        steps={steps}
        onDone={() => router.push("/dashboard")}
      />
    </div>
  );
}
