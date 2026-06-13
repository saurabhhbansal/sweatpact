"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { NotificationsList, SentInvitations } from "@/app/(tabs)/notifications/client";

type Notification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type SentInvitation = {
  id: string;
  to_user: string;
  to_username: string | null;
  to_name: string | null;
  penalty_cents: number;
  message: string | null;
  created_at: string;
};

// Notifications shown as an overlay instead of a separate screen. Fetches the
// full payload (notifications + pending sent invitations) when opened and
// reuses the same list components the /notifications route renders.
export function NotificationsOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [sent, setSent] = useState<SentInvitation[]>([]);

  // Keep the latest onClose in a ref so the open effect can stay keyed on
  // `open` alone — onClose is an inline arrow at the call site, so depending on
  // it would re-run the fetch + scroll-lock on every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let cancelled = false;
    setNotifications(null);
    fetch("/api/notifications?full=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setNotifications(d.notifications ?? []);
        setSent(d.sentInvitations ?? []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-xl">
      <div
        className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 pb-4 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Inbox</p>
          <p className="text-base font-semibold text-white">Notifications</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <div className="mx-auto max-w-md space-y-4">
          {notifications == null ? (
            <div className="space-y-3">
              <div className="h-20 animate-skeleton rounded-[2rem] bg-white/[0.08]" />
              <div className="h-20 animate-skeleton rounded-[2rem] bg-white/[0.08]" />
            </div>
          ) : (
            <>
              <section className="rounded-[2rem] glass-card p-5">
                <p className="mb-4 text-sm text-white/55">
                  {notifications.length === 0
                    ? "Nothing here yet."
                    : "Tap accept or decline to respond to challenges."}
                </p>
                <NotificationsList initial={notifications} />
              </section>

              {sent.length > 0 ? (
                <section className="rounded-[2rem] glass-card p-5">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-white">Sent challenges</h2>
                    <p className="mt-1 text-sm text-white/55">
                      Pending invitations you sent. Cancel to withdraw.
                    </p>
                  </div>
                  <SentInvitations initial={sent} />
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
