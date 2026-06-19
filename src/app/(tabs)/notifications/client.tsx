"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

type SentInvitation = {
  id: string;
  to_user: string;
  to_username: string | null;
  to_name: string | null;
  penalty_cents: number;
  message: string | null;
  created_at: string;
};

export function SentInvitations({ initial }: { initial: SentInvitation[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => setItems(initial), [initial]);

  async function cancel(id: string) {
    if (!confirm("Cancel this challenge?")) return;
    setBusyId(id);
    const res = await fetch("/api/challenges/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invitation_id: id }),
    });
    setBusyId(null);
    if (!res.ok) return;
    setItems((current) => current.filter((i) => i.id !== id));
    startTransition(() => router.refresh());
  }

  if (items.length === 0) return null;

  return (
    <ul className="space-y-3">
      {items.map((inv) => {
        const display = inv.to_name?.trim() || (inv.to_username ? `@${inv.to_username}` : "Unknown user");
        return (
          <li
            key={inv.id}
            className="animate-fade-up-item rounded-[2rem] border border-white/15 bg-white/[0.04] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white">
                  Waiting on{" "}
                  {inv.to_username ? (
                    <Link className="font-semibold hover:underline" href={`/u/${inv.to_username}`}>
                      {display}
                    </Link>
                  ) : (
                    <span className="font-semibold">{display}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-white/55">
                  {formatCents(inv.penalty_cents)}/week · {timeAgo(inv.created_at)}
                </p>
                {inv.message ? (
                  <p className="mt-1.5 rounded-[1rem] glass-card px-3 py-2 text-xs italic text-white/70">
                    &ldquo;{inv.message}&rdquo;
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busyId === inv.id}
                onClick={() => cancel(inv.id)}
                className="shrink-0 rounded-full"
              >
                {busyId === inv.id ? "…" : "Cancel"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type Notification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsList({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    const unreadIds = initial.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: unreadIds }),
    }).catch(() => {});
  }, [initial]);

  async function dismiss(id: string) {
    setErr(null);
    setItems((current) => current.filter((n) => n.id !== id));
    const res = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (!res.ok) {
      setErr("Couldn't dismiss that notification. It's been restored.");
      startTransition(() => router.refresh());
    }
  }

  async function clearAll() {
    setErr(null);
    setItems([]);
    const res = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) {
      setErr("Couldn't clear notifications. They've been restored.");
    }
    startTransition(() => router.refresh());
  }

  async function respond(item: Notification, action: "accept" | "decline") {
    const invitationId = item.payload?.invitation_id as string | undefined;
    if (!invitationId) return;
    setBusyId(item.id);
    const res = await fetch("/api/challenges/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invitation_id: invitationId, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) return;
    setItems((current) =>
      current.map((n) =>
        n.id === item.id
          ? { ...n, payload: { ...n.payload, _responded: action } }
          : n
      )
    );
    if (action === "accept" && data.group_id) {
      startTransition(() => {
        router.push(`/groups/${data.group_id}`);
        router.refresh();
      });
    } else {
      startTransition(() => router.refresh());
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-white/55">No notifications yet.</p>;
  }

  return (
    <div className="space-y-3">
      {err ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {err}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-white/55 transition hover:text-white"
        >
          Clear all
        </button>
      </div>
      <ul className="space-y-3">
      {items.map((item, index) => {
        const responded = (item.payload as any)?._responded as
          | "accept"
          | "decline"
          | undefined;
        const fromName =
          ((item.payload as any)?.from_name as string | undefined) ||
          ((item.payload as any)?.from_username as string | undefined) ||
          "Someone";
        const fromUsername = (item.payload as any)?.from_username as
          | string
          | undefined;
        const amountCents = (item.payload as any)?.penalty_cents as
          | number
          | undefined;
        const message = (item.payload as any)?.message as string | undefined;
        const isInvite = item.type === "challenge_invite_received";
        const actorName =
          ((item.payload as any)?.actor_name as string | undefined) ||
          ((item.payload as any)?.actor_username as string | undefined) ||
          "Someone";
        const groupId = (item.payload as any)?.group_id as string | undefined;
        const checkinStatus = (item.payload as any)?.status as string | undefined;

        return (
          <li
            key={item.id}
            className={`animate-fade-up-item relative rounded-[2rem] border px-4 py-3 ${
              item.read_at ? "border-white/10 bg-white/[0.04]" : "border-white/20 bg-white/[0.08]"
            }`}
            style={{ "--stagger": `${index * 50}ms` } as React.CSSProperties}
          >
            {!item.read_at ? (
              <span className="absolute right-10 top-3.5 h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden="true" />
            ) : null}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {isInvite ? (
              <div className="space-y-2 pr-6">
                <p className="text-sm text-white">
                  <span className="font-semibold">
                    {fromUsername ? (
                      <Link className="hover:underline" href={`/u/${fromUsername}`}>
                        {fromName}
                      </Link>
                    ) : (
                      fromName
                    )}
                  </span>{" "}
                  challenged you
                  {amountCents != null ? ` for ${formatCents(amountCents)}/week` : ""}.
                </p>
                {message ? (
                  <p className="rounded-[1rem] glass-card px-3 py-2 text-xs italic text-white/70">
                    &ldquo;{message}&rdquo;
                  </p>
                ) : null}
                <p className="text-[11px] text-white/40">{timeAgo(item.created_at)}</p>
                {responded ? (
                  <p className="text-xs text-white/55">
                    {responded === "accept" ? "Accepted." : "Declined."}
                  </p>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => respond(item, "accept")}
                      className="flex-1"
                    >
                      {busyId === item.id ? "…" : "Accept"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => respond(item, "decline")}
                      className="flex-1"
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ) : item.type === "challenge_accepted" ? (
              <div className="space-y-1 pr-6">
                <p className="text-sm text-white">Your challenge was accepted.</p>
                <p className="text-[11px] text-white/40">{timeAgo(item.created_at)}</p>
                {(item.payload as any)?.group_id ? (
                  <Link
                    href={`/groups/${(item.payload as any).group_id}`}
                    className="text-xs text-white underline hover:no-underline"
                  >
                    Open challenge →
                  </Link>
                ) : null}
              </div>
            ) : item.type === "challenge_declined" ? (
              <div className="space-y-1 pr-6">
                <p className="text-sm text-white">Your challenge was declined.</p>
                <p className="text-[11px] text-white/40">{timeAgo(item.created_at)}</p>
              </div>
            ) : item.type === "cycle_share_granted" ? (
              <div className="space-y-1 pr-6">
                <p className="text-sm text-white">
                  <span className="font-semibold">
                    {fromUsername ? (
                      <Link className="hover:underline" href={`/u/${fromUsername}`}>
                        {fromName}
                      </Link>
                    ) : (
                      fromName
                    )}
                  </span>{" "}
                  shared their cycle data with you.
                </p>
                <p className="text-[11px] text-white/40">{timeAgo(item.created_at)}</p>
                {fromUsername ? (
                  <Link
                    href={`/u/${fromUsername}`}
                    className="text-xs text-white underline hover:no-underline"
                  >
                    View cycle data →
                  </Link>
                ) : null}
              </div>
            ) : item.type === "group_checkin" || item.type === "group_rest_day" ? (
              <div className="space-y-1 pr-6">
                <p className="text-sm text-white">
                  <span className="font-semibold">{actorName}</span>{" "}
                  {item.type === "group_rest_day"
                    ? "took a rest day"
                    : checkinStatus === "unverified"
                      ? "logged an unverified check-in"
                      : "checked in"}
                  .
                </p>
                <p className="text-[11px] text-white/40">{timeAgo(item.created_at)}</p>
                {groupId ? (
                  <Link
                    href={`/groups/${groupId}`}
                    className="text-xs text-white underline hover:no-underline"
                  >
                    Open challenge →
                  </Link>
                ) : null}
              </div>
            ) : item.type === "partner_period_reminder" ? (
              (() => {
                const ownerUsername = (item.payload as any)?.owner_username as string | undefined;
                const ownerName = (item.payload as any)?.owner_name as string | undefined;
                const ownerDisplay = ownerName?.trim() || (ownerUsername ? `@${ownerUsername}` : "Someone");
                const predictedStart = (item.payload as any)?.predicted_start as string | undefined;
                return (
                  <div className="space-y-1 pr-6">
                    <p className="text-sm text-white">
                      <span className="font-semibold">
                        {ownerUsername ? (
                          <Link className="hover:underline" href={`/u/${ownerUsername}`}>
                            {ownerDisplay}
                          </Link>
                        ) : (
                          ownerDisplay
                        )}
                      </span>
                      {predictedStart
                        ? `'s period is predicted to start on ${new Date(predictedStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`
                        : "'s period may be starting soon."}
                    </p>
                    <p className="text-[11px] text-white/40">{timeAgo(item.created_at)}</p>
                    {ownerUsername ? (
                      <Link
                        href={`/u/${ownerUsername}`}
                        className="text-xs text-white underline hover:no-underline"
                      >
                        View cycle data →
                      </Link>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              <div className="space-y-1 pr-6">
                <p className="text-sm text-white">{item.type.replace(/_/g, " ")}</p>
                <p className="text-[11px] text-white/40">{timeAgo(item.created_at)}</p>
              </div>
            )}
          </li>
        );
      })}
      </ul>
    </div>
  );
}
