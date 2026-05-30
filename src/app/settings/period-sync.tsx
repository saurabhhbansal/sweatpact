"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

const SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/41571ae1c985413fbd09facd41786706";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function PeriodSyncCard({
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

  useEffect(() => {
    if (!pendingRef.current) setEnabled(initialEnabled);
  }, [initialEnabled]);

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
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      setEnabled(prev);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Period sync from Apple Health</p>
          <p className="mt-1 text-xs text-white/55">
            A daily iOS Shortcut pulls your menstrual flow entries from Apple Health and marks those days as excused — no manual logging needed.
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

      {enabled ? (
        <>
          <p className="text-xs text-white/45">
            Last synced: <span className="text-white/70">{timeAgo(initialLastSyncedAt)}</span>
          </p>
          <a
            href={SHORTCUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <Download className="h-4 w-4" />
            Install Period Sync Shortcut
          </a>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/65">
            <p className="font-semibold text-white">Set up once</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-white/65">
              <li>
                Tap the install button above. When iOS Shortcuts opens, it&apos;ll ask for your User ID and Secret Key — copy them from the{" "}
                <Link href="/shortcut" className="underline text-white/65 hover:text-white">
                  Shortcut setup page
                </Link>
                .
              </li>
              <li>
                Open the <strong>Shortcuts</strong> app → <strong>Automation</strong> → New Personal Automation → <em>Time of Day</em> → pick a time like 06:00, daily.
              </li>
              <li>
                Action: run <em>SweatPact Period Sync</em>. Toggle off <strong>Ask before running</strong> so it&apos;s silent.
              </li>
            </ol>
            <p className="mt-2 text-white/45">
              Same credentials as the gym check-in Shortcut. iOS will prompt you for the values on first install only.
            </p>
          </div>
        </>
      ) : null}

      {err ? <p className="text-xs text-white/85">{err}</p> : null}
    </div>
  );
}
