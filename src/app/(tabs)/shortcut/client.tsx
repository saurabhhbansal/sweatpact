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
  highlights,
}: {
  src: string | null;
  alt: string;
  placeholder?: React.ReactNode;
  highlights?: HighlightRegion[];
}) {
  return (
    <div className="relative mx-auto w-[220px] select-none">
      {/* Shell */}
      <div className="relative rounded-[3rem] border-[7px] border-white/15 bg-black shadow-2xl shadow-black/70 ring-1 ring-inset ring-white/[0.07]">
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-2.5 z-10 h-[17px] w-[76px] -translate-x-1/2 rounded-full bg-black" />
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-neutral-900">
          {src ? (
            <>
              <img src={src} alt={alt} className="w-full object-cover" draggable={false} />
              {highlights && highlights.length > 0 ? (
                // SVG overlay: dark fill with rectangular cutouts over highlight regions.
                // Using a mask so multiple highlights work without double-darkening.
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <defs>
                    <mask id="highlight-mask">
                      {/* White = show overlay; black = cut out (keep bright) */}
                      <rect width="100" height="100" fill="white" />
                      {highlights.map((h, i) => (
                        <rect
                          key={i}
                          x={h.x}
                          y={h.y}
                          width={h.w}
                          height={h.h}
                          rx={h.r ?? 1}
                          fill="black"
                        />
                      ))}
                    </mask>
                  </defs>
                  <rect
                    width="100"
                    height="100"
                    fill="rgba(0,0,0,0.65)"
                    mask="url(#highlight-mask)"
                  />
                </svg>
              ) : null}
            </>
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

// Highlight region — coordinates as 0–100 percentages of the screenshot dimensions.
// One or more regions stay at full brightness; everything outside is dimmed.
type HighlightRegion = {
  x: number;   // % from left
  y: number;   // % from top
  w: number;   // % width
  h: number;   // % height
  r?: number;  // border-radius in px (default 8)
};

type WizardStep = {
  title: string;
  description: React.ReactNode;
  screenshot: string | null;
  screenshotAlt: string;
  action?: StepAction;
  // When provided, a dark SVG overlay dims everything outside these regions.
  highlights?: HighlightRegion[];
};

// ─── Step definitions ─────────────────────────────────────────────────────────

const GYM_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/e8ad937c480b4a4ea5f34dd4d8475b71";
const PERIOD_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/17a2f0e5651c4c6287dc5e1def0acbf6";

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
      title: "Install the Shortcut",
      description: (
        <>
          Tap the button below. Safari opens a preview sheet — tap{" "}
          <strong>Set Up Shortcut</strong>.
        </>
      ),
      screenshot: "/screenshots/shortcuts-install-gym.png",
      screenshotAlt: "Shortcut install page with Set Up Shortcut button",
      action: { type: "gym-install" },
      // Highlight the "Set Up Shortcut" blue button at the bottom
      highlights: [{ x: 6, y: 86.5, w: 88, h: 6.5, r: 6 }],
    },
    {
      title: "Enter your credentials",
      description: (
        <>
          The Shortcut will immediately ask for your <strong>User ID</strong>{" "}
          and <strong>Secret Key</strong>. Paste them from the fields below —
          tap each copy button, then paste into the iOS prompt.
        </>
      ),
      screenshot: "/screenshots/shortcuts-enter-credentials.png",
      screenshotAlt: "iOS Configure This Shortcut screen with User Id and Secret Key fields",
      action: { type: "credentials", userId, webhookSecret },
      // Highlight User Id row, Secret Key row, and Add Shortcut button
      highlights: [
        { x: 4, y: 30, w: 92, h: 5.5, r: 2 },   // User Id row
        { x: 4, y: 35.3, w: 92, h: 5.5, r: 2 }, // Secret Key row
        { x: 6, y: 81, w: 88, h: 7, r: 6 },     // Add Shortcut button
      ],
    },
    {
      title: "Open Shortcuts → Automation",
      description: (
        <>
          Open the <strong>Shortcuts</strong> app on your iPhone. Tap the{" "}
          <strong>Automation</strong> tab at the bottom, then tap the{" "}
          <strong>+</strong> button at the top right to create a new automation.
        </>
      ),
      screenshot: "/screenshots/shortcuts-automation-tab.png",
      screenshotAlt: "Shortcuts Automation tab with + button",
      // Highlight the + button in the top-right corner
      highlights: [{ x: 84, y: 7, w: 13, h: 5.5, r: 6 }],
    },
    {
      title: "Select Arrive",
      description: (
        <>
          Scroll down and tap <strong>Arrive</strong> from the Personal
          Automation list. This triggers the Shortcut whenever your iPhone
          detects you arriving at a location you set.
        </>
      ),
      screenshot: "/screenshots/shortcuts-arrive-type.png",
      screenshotAlt: "Personal Automation list with Arrive row",
      // Highlight the Arrive row (roughly mid-screen in the type picker)
      highlights: [{ x: 5, y: 52, w: 90, h: 8.5, r: 2 }],
    },
    {
      title: "Set your gym & run immediately",
      description: (
        <>
          Tap <strong>Location</strong> and search for your gym. Then select{" "}
          <strong>Run Immediately</strong> so the check-in fires silently the
          moment you arrive — no confirmation prompt. Tap <strong>Next</strong>.
        </>
      ),
      screenshot: "/screenshots/shortcuts-arrive-confirm.png",
      screenshotAlt: "When config showing gym location and Run Immediately selected",
      // Highlight Location row and Run Immediately row
      highlights: [
        { x: 5, y: 22.8, w: 90, h: 6.2, r: 2 },  // Location row
        { x: 5, y: 59.5, w: 90, h: 6.5, r: 2 },  // Run Immediately row
      ],
    },
    {
      title: "Select the SweatPact shortcut",
      description: (
        <>
          Type <strong>SweatPact</strong> in the search bar at the bottom.
          Tap <strong>SweatPact CheckIn</strong> when it appears — you&apos;ll
          see a checkmark confirming it&apos;s been assigned to this automation.
        </>
      ),
      screenshot: "/screenshots/shortcuts-add-action-gym.png",
      screenshotAlt: "SweatPact CheckIn shortcut card selected with checkmark",
      // Highlight the shortcut card and the search bar
      highlights: [
        { x: 5, y: 27, w: 43, h: 13, r: 3 },   // SweatPact Chec... card
        { x: 7, y: 91, w: 70, h: 6.5, r: 8 },  // Search bar
      ],
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
      title: "Install the Shortcut",
      description: (
        <>
          Tap the button below. Safari opens a preview — tap{" "}
          <strong>Add Shortcut</strong>.
        </>
      ),
      screenshot: "/screenshots/shortcuts-install-period.png",
      screenshotAlt: "SweatPact Period Sync install page with Add Shortcut button",
      action: { type: "period-install" },
      // Highlight the Add Shortcut button at the bottom
      highlights: [{ x: 6, y: 86.5, w: 88, h: 6.5, r: 6 }],
    },
    {
      title: "Enter your User ID",
      description: (
        <>
          The Shortcut asks for your <strong>User ID</strong> first. Copy it
          below and paste it into the field, then tap <strong>Next</strong>.
        </>
      ),
      screenshot: "/screenshots/shortcuts-period-enter-userid.png",
      screenshotAlt: "Configure shortcut screen asking for UserID with Next button",
      action: { type: "credentials", userId, webhookSecret },
      // Highlight the UserID text field and the Next button
      highlights: [
        { x: 2, y: 30, w: 96, h: 9, r: 2 },  // UserID field row
        { x: 6, y: 81, w: 88, h: 7, r: 6 },  // Next button
      ],
    },
    {
      title: "Enter your Secret Key",
      description: (
        <>
          Next it asks for your <strong>Secret Key</strong>. Copy it below,
          paste it in, then tap <strong>Add Shortcut</strong>.
        </>
      ),
      screenshot: "/screenshots/shortcuts-period-enter-secret.png",
      screenshotAlt: "Configure shortcut screen asking for Secret with Add Shortcut button",
      action: { type: "credentials", userId, webhookSecret },
      // Highlight the Secret field and the Add Shortcut button
      highlights: [
        { x: 2, y: 30, w: 96, h: 9, r: 2 },  // Secret field row
        { x: 6, y: 81, w: 88, h: 7, r: 6 },  // Add Shortcut button
      ],
    },
    {
      title: "Open Shortcuts → Automation",
      description: (
        <>
          Open the <strong>Shortcuts</strong> app, tap the{" "}
          <strong>Automation</strong> tab at the bottom, then tap{" "}
          <strong>+</strong>.
        </>
      ),
      screenshot: "/screenshots/shortcuts-automation-tab.png",
      screenshotAlt: "Shortcuts Automation tab with + button",
      highlights: [{ x: 84, y: 7, w: 13, h: 5.5, r: 6 }],
    },
    {
      title: "Set up a daily Time of Day automation",
      description: (
        <>
          Tap <strong>New Automation</strong> → <strong>Time of Day</strong>.
          Scroll the time picker to a time you are reliably awake. Under
          Repeat, select <strong>Daily</strong>. Under run mode, select{" "}
          <strong>Run Immediately</strong>. Tap <strong>Next</strong>.
        </>
      ),
      screenshot: "/screenshots/shortcuts-time-of-day.png",
      screenshotAlt: "Time of Day picker with Daily and Run Immediately selected",
      // Highlight time picker, Daily row, and Run Immediately row
      highlights: [
        { x: 5, y: 26, w: 90, h: 21, r: 2 },    // time picker wheel
        { x: 5, y: 56.5, w: 90, h: 6.5, r: 2 }, // Daily row
        { x: 5, y: 86, w: 90, h: 5.5, r: 2 },   // Run Immediately row
      ],
    },
    {
      title: "Select the SweatPact Period Sync shortcut",
      description: (
        <>
          Type <strong>SweatPact</strong> in the search bar at the bottom.
          Tap <strong>SweatPact Period Sync</strong> when it appears — a
          checkmark confirms it has been assigned to this automation.
        </>
      ),
      screenshot: "/screenshots/shortcuts-add-action-period.png",
      screenshotAlt: "SweatPact Perio... shortcut card selected with checkmark",
      // Highlight the shortcut card and search bar
      highlights: [
        { x: 5, y: 27, w: 43, h: 13, r: 3 },   // SweatPact Perio... card
        { x: 7, y: 91, w: 70, h: 6.5, r: 8 },  // Search bar
      ],
    },
    {
      title: "All set",
      description: (
        <>
          The sync will now run silently every day, pulling the last 60 days
          of flow data from Apple Health. Period days are automatically marked
          as excused in SweatPact — no manual logging needed.
        </>
      ),
      screenshot: null,
      screenshotAlt: "Setup complete",
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

      {/* Step body — keyed so each step transition reads as a state change */}
      <div key={index} className="animate-state-in space-y-6">
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

      {/* Phone frame — all steps except pure-action ones */}
      {step.action?.type !== "credentials" && step.action?.type !== "rotate" ? (
        <PhoneFrame
          src={step.screenshot}
          alt={step.screenshotAlt}
          highlights={step.highlights}
        />
      ) : null}

      {/* For the credentials-entry step: phone frame above (when screenshot exists), copy fields below */}
      {step.action?.type === "credentials" && step.screenshot ? (
        <>
          <PhoneFrame
            src={step.screenshot}
            alt={step.screenshotAlt}
            highlights={step.highlights}
          />
          <div className="space-y-3 rounded-[1.4rem] glass-card p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Paste these when prompted</p>
            <CopyField label="User ID" value={step.action.userId} />
            <CopyField label="Secret Key" value={step.action.webhookSecret} hidden />
          </div>
        </>
      ) : step.action?.type === "credentials" && !step.screenshot ? (
        <div className="space-y-3 rounded-[1.4rem] glass-card p-4">
          <CopyField label="User ID" value={step.action.userId} />
          <CopyField label="Secret Key" value={step.action.webhookSecret} hidden />
        </div>
      ) : step.action?.type === "rotate" ? (
        <div className="space-y-3 rounded-[1.4rem] glass-card p-4">
          <p className="text-xs font-medium text-white/70">Secret Key</p>
          <p className="text-xs text-white/45">
            Rotate it if it ever leaks. Your Shortcut will need to be
            reinstalled with the new secret.
          </p>
          <RotateSecretButton />
        </div>
      ) : null}
      </div>

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
        <div className="grid grid-cols-2 gap-1.5 rounded-[1.4rem] glass-card p-1">
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
