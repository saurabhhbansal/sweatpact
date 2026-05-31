"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckInButton } from "@/components/check-in-button";
import { ExcuseButton } from "@/components/excuse-button";

const EXCUSED_STATUSES = new Set(["sick_day", "gym_closed", "rest_day", "period_day"]);

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
  // Optimistic override flipped by child buttons. Server refresh will replace
  // this with the canonical status once it lands.
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  // Reset the optimistic override whenever the server-provided status changes
  // — that means the refresh round-trip has landed, so we should trust it.
  useEffect(() => {
    setOverrideStatus(null);
  }, [initialStatus]);
  const todayStatus = overrideStatus ?? initialStatus;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      {todayStatus === "pending" && isTodayRestDay ? (
        <div className="py-2 text-center">
          <p className="text-lg font-semibold text-white">Scheduled rest day</p>
          <p className="mt-1 text-sm text-white/55">
            You planned today as a rest day.{" "}
            <Link href="/settings" className="underline text-white/40">
              Change
            </Link>
          </p>
          <div className="mt-4">
            <CheckInButton onOptimistic={(s) => setOverrideStatus(s)} />
          </div>
        </div>
      ) : todayStatus === "pending" ? (
        <>
          {gymCount === 0 ? (
            <p className="mb-3 rounded-[1.2rem] border border-white/20 bg-white/[0.04] p-3 text-sm text-white/80">
              Set your gym location in{" "}
              <Link className="underline" href="/settings">
                Settings
              </Link>{" "}
              to unlock verified check-ins.
            </p>
          ) : null}
          <CheckInButton onOptimistic={(s) => setOverrideStatus(s)} />
          <div className="mt-3 text-center text-xs text-white/50">
            Need a valid excuse for today?
            <ExcuseButton
              gender={gender}
              onOptimistic={(s) => setOverrideStatus(s)}
            />
          </div>
        </>
      ) : todayStatus === "verified" ? (
        <div className="py-2 text-center">
          <p className="text-xl font-semibold text-white">Verified and locked in</p>
          <p className="mt-1 text-sm text-white/62">Your streak already reflects it.</p>
        </div>
      ) : todayStatus === "unverified" ? (
        <div className="py-2 text-center">
          <p className="text-xl font-semibold text-white">Unverified, but counted</p>
          <p className="mt-1 text-sm text-white/62">
            Managers can reverse it, otherwise it keeps your streak alive.
          </p>
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
          <p className="mt-1 text-sm text-white/55">{todayStatus.replace(/_/g, " ")}</p>
        </div>
      ) : (
        <div className="py-2 text-center">
          <p className="text-lg font-semibold text-white">Waiting on another attempt</p>
          <p className="mt-1 text-sm text-white/55">Nothing is counted for today yet.</p>
        </div>
      )}
    </section>
  );
}
