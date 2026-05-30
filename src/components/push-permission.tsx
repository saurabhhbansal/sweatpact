"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

type State =
  | "unsupported"
  | "default"
  | "granted-subscribed"
  | "granted-unsubscribed"
  | "denied"
  | "loading"
  | "working";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  let reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) {
    reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }
  return reg;
}

/**
 * `compact` shows a tiny bell button — for nav placement. Default shows
 * an inline card with a label + button + status message — for settings.
 */
export function PushPermissionPrompt({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      const perm = Notification.permission;
      if (perm === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      if (perm === "default") {
        if (!cancelled) setState("default");
        return;
      }
      // granted — check if we have an active subscription
      try {
        const reg = await ensureRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "granted-subscribed" : "granted-unsubscribed");
      } catch {
        if (!cancelled) setState("granted-unsubscribed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("Push isn't configured on this site yet.");
      }

      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default");
        return;
      }

      const reg = await ensureRegistration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(publicKey),
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Couldn't save subscription.");
      setState("granted-subscribed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg);
      setState("granted-unsubscribed");
    }
  }

  async function disable() {
    setError(null);
    setState("working");
    try {
      const reg = await ensureRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
          method: "DELETE",
        });
      }
      setState("granted-unsubscribed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg);
      setState("granted-subscribed");
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  if (compact) {
    if (state === "granted-subscribed") return null;
    return (
      <button
        type="button"
        onClick={enable}
        disabled={state === "working" || state === "denied"}
        className="flex h-8 items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.06] px-3 text-xs text-white/85 transition hover:bg-white/[0.12] disabled:opacity-50"
      >
        <Bell className="h-3.5 w-3.5" />
        {state === "working" ? "Enabling…" : state === "denied" ? "Blocked" : "Enable alerts"}
      </button>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-white/15 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-white">
            {state === "granted-subscribed" ? (
              <Bell className="h-4 w-4 text-white" />
            ) : (
              <BellOff className="h-4 w-4 text-white/55" />
            )}
            Push notifications
          </p>
          <p className="mt-1 text-xs text-white/55">
            {state === "granted-subscribed"
              ? "On — challenges and updates will pop up even when SweatPact isn't open."
              : state === "denied"
                ? "Blocked in your browser. To turn on, enable notifications for this site in your browser settings."
                : "Get notified about new challenges and responses even when you're not on the site."}
          </p>
          {error ? <p className="mt-1 text-xs text-white/85">{error}</p> : null}
        </div>
        {state === "granted-subscribed" ? (
          <button
            type="button"
            onClick={disable}
            disabled={state === ("working" as State)}
            className="shrink-0 rounded-full border border-white/25 bg-transparent px-3 py-1.5 text-xs text-white/85 transition hover:bg-white/[0.06]"
          >
            Turn off
          </button>
        ) : state === "denied" ? null : (
          <button
            type="button"
            onClick={enable}
            disabled={state === "working"}
            className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {state === "working" ? "…" : "Enable"}
          </button>
        )}
      </div>
    </div>
  );
}
