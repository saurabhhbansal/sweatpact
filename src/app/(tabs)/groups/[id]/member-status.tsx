"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { statusToken, statusRing, TONE_TEXT } from "@/lib/challenge-view";
import {
  Dialog,
  DialogContent,
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

// A status-ringed avatar that opens a member preview: avatar, status, today's
// check-ins, a link to the full profile, and — for managers viewing someone
// else — reverse-checkin / change-role / remove actions.
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
  const showManageRow = manageable && role !== "owner" && (isOwner || canRemove);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center transition hover:opacity-80"
      >
        <div className={cn("rounded-full p-0.5", ring)}>
          <Avatar url={member.avatar_url} name={member.name} username={member.username} size={size} />
        </div>
        {showLabel ? (
          <div className="mt-2 text-center">
            <p className="truncate text-sm font-semibold text-white">
              {isSelf ? "You" : member.name}
            </p>
            <p className={`mt-0.5 text-xs ${TONE_TEXT[token.tone]}`}>
              {token.icon} {token.label}
            </p>
          </div>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{member.name}</DialogTitle>
          </DialogHeader>

          {/* Member header — ringed avatar + identity + today's status */}
          <div className="flex items-center gap-4">
            <div className={cn("shrink-0 rounded-full p-0.5", ring)}>
              <Avatar url={member.avatar_url} name={member.name} username={member.username} size="lg" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-white">
                {isSelf ? "You" : member.name}
              </p>
              {member.username ? (
                <p className="truncate text-sm text-white/55">@{member.username}</p>
              ) : null}
              <p className={`mt-1 text-sm ${TONE_TEXT[token.tone]}`}>
                {token.icon} {token.label} today
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Today's check-ins + reverse (managers only) */}
            {checkins.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
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
                      {manageable && c.status === "unverified" ? (
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
              <p className="text-sm text-white/55">
                No check-in from {isSelf ? "you" : member.name} today.
              </p>
            )}

            {/* Role + remove management (managers only) */}
            {showManageRow ? (
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
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.14]"
              >
                View full profile
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
