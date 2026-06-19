"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { EXCUSED_STATUSES } from "@/lib/derived-status";
import { CheckInButton } from "@/components/check-in-button";
import { ExcuseButton } from "@/components/excuse-button";
import { UndoCheckinButton } from "@/components/undo-checkin-button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const EXCUSED_LABEL: Record<string, string> = {
  sick_day: "Sick day logged. Your streak is safe.",
  rest_day: "Rest day logged. Your streak is safe.",
  gym_closed: "Logged as a rest day. Your streak is safe.",
  period_day: "Period day logged. Your streak is safe.",
};

export function TodayActionCard({
  initialStatus,
  isTodayRestDay,
  gymCount,
  gender,
}: {
  initialStatus: string;
  isTodayRestDay: boolean;
  gymCount: number;
  gender: string;
}) {
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  const [excuseOpen, setExcuseOpen] = useState(false);

  useEffect(() => {
    setOverrideStatus(null);
    setExcuseOpen(false);
  }, [initialStatus]);

  const todayStatus = overrideStatus ?? initialStatus;

  return (
    <section className="rounded-[2rem] glass-card p-4">
      {/* Keyed on status so a check-in or excuse visibly transforms the card
          instead of the content flickering in place. */}
      <div key={todayStatus} className="animate-state-in">
      {todayStatus === "pending" && isTodayRestDay ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-white/60">Rest day · going still counts</p>
          <CheckInButton compact onOptimistic={(s) => setOverrideStatus(s)} />
        </div>
      ) : todayStatus === "pending" ? (
        <div className="space-y-3">
          {gymCount === 0 ? (
            <p className="rounded-[1.2rem] border border-white/20 bg-white/[0.04] p-3 text-sm text-white/70">
              Set your gym location in{" "}
              <Link className="underline" href="/settings">Settings</Link>{" "}
              to unlock verified check-ins.
            </p>
          ) : null}
          <Dialog open={excuseOpen} onOpenChange={setExcuseOpen}>
            <div className="flex items-center gap-2">
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Log excused day"
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.98] ${
                    excuseOpen
                      ? "border-white/20 bg-white/[0.12] text-white/80"
                      : "border-white/15 bg-white/[0.06] text-white/55 hover:border-white/20 hover:bg-white/[0.10] hover:text-white/75"
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogTrigger>
              <div className="flex-1">
                <CheckInButton onOptimistic={(s) => setOverrideStatus(s)} />
              </div>
            </div>
            <DialogContent className="max-w-sm">
              <ExcuseButton
                gender={gender}
                onOptimistic={(s) => setOverrideStatus(s)}
                onClose={() => setExcuseOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      ) : todayStatus === "verified" ? (
        <div className="py-2 text-center">
          <p className="text-xl font-semibold text-white">Verified and locked in</p>
          <p className="mt-1 text-sm text-white/65">Your streak already reflects it.</p>
        </div>
      ) : todayStatus === "unverified" ? (
        <div className="space-y-3 py-2 text-center">
          <div>
            <p className="text-xl font-semibold text-white">Unverified, but counted</p>
            <p className="mt-1 text-sm text-white/65">
              It keeps your streak alive. Whoever runs your challenge can reverse it.
            </p>
          </div>
          <UndoCheckinButton onUndo={() => setOverrideStatus("pending")} />
        </div>
      ) : todayStatus === "period_day" ? (
        <div className="space-y-4 py-1">
          <div className="text-center">
            <p className="text-lg font-semibold text-white">Period day — you&apos;re excused</p>
            <p className="mt-1 text-sm text-white/55">
              No pressure to go today. But if you do, it counts.
            </p>
          </div>
          <CheckInButton periodDayMode onOptimistic={(s) => setOverrideStatus(s)} />
        </div>
      ) : EXCUSED_STATUSES.has(todayStatus) ? (
        <div className="py-2 text-center">
          <p className="text-lg font-semibold text-white">Excused for today</p>
          <p className="mt-1 text-sm text-white/55">{EXCUSED_LABEL[todayStatus] ?? "Your streak is safe."}</p>
        </div>
      ) : todayStatus === "missed" ? (
        <div className="py-2 text-center">
          <p className="text-lg font-semibold text-white">Missed — day&apos;s done</p>
          <p className="mt-1 text-sm text-white/55">Today didn&apos;t count. You can still hit your weekly goal.</p>
        </div>
      ) : todayStatus === "rejected" ? (
        <div className="py-2 text-center">
          <p className="text-lg font-semibold text-white">Check-in rejected</p>
          <p className="mt-1 text-sm text-white/55">Whoever runs your challenge reversed this check-in.</p>
        </div>
      ) : (
        <div className="py-2 text-center">
          <p className="text-lg font-semibold text-white">Waiting on today</p>
          <p className="mt-1 text-sm text-white/55">Nothing is counted yet.</p>
        </div>
      )}
      </div>
    </section>
  );
}
