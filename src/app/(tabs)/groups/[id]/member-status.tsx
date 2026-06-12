"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { statusToken, statusRing, TONE_TEXT } from "@/lib/challenge-view";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ReverseCheckinButton, RemoveMemberButton, UpdateMemberRoleButton } from "./client";

type AvatarSize = "sm" | "md" | "lg";

export type MemberCheckin = {
  id: string;
  status: string;
  occurredLabel: string;
};

// A status-ringed avatar. For managers (and non-self members) the avatar is a
// button that opens a manage overlay: reverse unverified check-ins, change role,
// remove member. Otherwise it's a plain ringed avatar with a status label.
export function MemberStatusAvatar({
  userId,
  member,
  status,
  size = "md",
  showLabel = true,
  groupId,
  isManager,
  isOwner,
  isSelf,
  canRemove,
  role,
  checkins,
}: {
  userId: string;
  member: { name: string; username: string | null; avatar_url: string | null };
  status: string;
  size?: AvatarSize;
  showLabel?: boolean;
  groupId: string;
  isManager: boolean;
  isOwner: boolean;
  isSelf: boolean;
  canRemove: boolean;
  role: "owner" | "admin" | "member";
  checkins: MemberCheckin[];
}) {
  const [open, setOpen] = useState(false);
  const token = statusToken(status);
  const ring = statusRing(status);
  const manageable = isManager && !isSelf;

  const ringed = (
    <div className={cn("rounded-full p-0.5", ring)}>
      <Avatar url={member.avatar_url} name={member.name} username={member.username} size={size} />
    </div>
  );

  const label = showLabel ? (
    <div className="mt-2 text-center">
      <p className="truncate text-sm font-semibold text-white">
        {isSelf ? "You" : member.name}
      </p>
      <p className={`mt-0.5 text-xs ${TONE_TEXT[token.tone]}`}>
        {token.icon} {token.label}
      </p>
    </div>
  ) : null;

  if (!manageable) {
    return (
      <div className="flex flex-col items-center">
        {ringed}
        {label}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center transition hover:opacity-80"
      >
        {ringed}
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{member.name}</DialogTitle>
            <DialogDescription>
              {token.icon} {token.label} today
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            {/* Today's check-ins + reverse */}
            {checkins.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Today&apos;s check-ins
                </p>
                {checkins.map((c) => {
                  const ct = statusToken(c.status);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-[1rem] glass-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className={`text-sm ${TONE_TEXT[ct.tone]}`}>{ct.label}</p>
                        <p className="mt-0.5 text-xs text-white/45">{c.occurredLabel}</p>
                      </div>
                      {c.status === "unverified" ? (
                        <ReverseCheckinButton
                          groupId={groupId}
                          checkinId={c.id}
                          memberName={member.name}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/55">No check-in from {member.name} today.</p>
            )}

            {/* Role + remove management */}
            {role !== "owner" && (isOwner || canRemove) ? (
              <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
                {isOwner ? (
                  <UpdateMemberRoleButton groupId={groupId} userId={userId} role={role} />
                ) : null}
                {canRemove ? (
                  <RemoveMemberButton groupId={groupId} userId={userId} name={member.name} />
                ) : null}
              </div>
            ) : null}

            {member.username ? (
              <Link
                href={`/u/${member.username}`}
                className="inline-block text-xs text-white/55 underline transition hover:text-white"
              >
                View @{member.username}
              </Link>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
