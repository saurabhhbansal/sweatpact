"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Droplet, X } from "lucide-react";
import { CycleView } from "@/app/(tabs)/cycle/client";
import type { PeriodStats } from "@/lib/period-stats";

type FlowLevel = "light" | "medium" | "heavy" | "unspecified";
type PeriodRecord = { local_day: string; flow_level: FlowLevel };

export function CycleDataPopup({
  stats,
  records,
  today,
  targetName,
  lastSyncedAt,
}: {
  stats: PeriodStats;
  records: PeriodRecord[];
  today: string;
  targetName: string;
  lastSyncedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
      >
        <Droplet className="h-4 w-4" />
        See cycle data
      </button>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-xl">
              <div
                className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/60 px-4 pb-4 backdrop-blur-xl"
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Cycle data</p>
                  <p className="truncate text-base font-semibold text-white">{targetName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div
                className="flex-1 overflow-y-auto px-4 pt-5"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
              >
                <div className="mx-auto max-w-md">
                  <CycleView today={today} stats={stats} records={records} lastSyncedAt={lastSyncedAt} readonly />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
