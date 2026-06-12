"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { deriveDayStatus } from "@/lib/derived-status";

type HistoryEntry = { local_day: string; status: string };

const DOW = ["S", "M", "T", "W", "T", "F", "S"]; // index = getUTCDay() (0=Sun)
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short" });

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// Human-readable status for screen readers (status is otherwise colour-only).
function humanStatus(status: string): string {
  switch (status) {
    case "verified":
      return "checked in";
    case "unverified":
      return "checked in (unverified)";
    case "missed":
      return "missed";
    case "rejected":
      return "rejected";
    case "rest_day":
    case "gym_closed":
      return "rest day";
    case "sick_day":
      return "sick day";
    case "period_day":
      return "period day";
    case "future":
      return "upcoming";
    default:
      return "no check-in";
  }
}

// Resolve the colour treatment for a day's status.
function tone(status: string): string {
  switch (status) {
    case "verified":
      return "bg-emerald-500/90 text-black";
    case "unverified":
      return "border border-dashed border-emerald-400 text-emerald-300";
    case "missed":
    case "rejected":
      return "border border-red-500/70 bg-red-500/15 text-red-300";
    case "rest_day":
    case "sick_day":
    case "gym_closed":
    case "period_day":
      return "border border-white/15 bg-white/[0.06] text-white/55";
    case "future":
      return "border border-white/[0.06] text-white/20";
    default: // pending — today only, still time to check in
      return "border border-white/10 text-white/30";
  }
}

export function CheckinStrip({
  today,
  startDay,
  history,
  restDays,
}: {
  today: string;
  startDay: string;
  history: HistoryEntry[];
  restDays: number[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Start hidden so the SSR-rendered HTML (scrollLeft=0 = account start) is
  // never visible. useLayoutEffect sets the scroll and then reveals the strip
  // in the same render batch, so the first painted frame shows today centred.
  const [ready, setReady] = useState(false);

  const statusByDay = new Map<string, string>();
  for (const row of history) statusByDay.set(row.local_day, row.status);

  // Build the day list: account creation → today + 7.
  // The extra future days let today scroll to the horizontal centre; they are
  // visually dimmed and have no box so they're not mistaken for rest days.
  const start = startDay <= today ? startDay : today;
  const end = addDays(today, 7);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
    if (days.length > 800) break; // safety cap (~2 years)
  }

  // Set scroll position and reveal the strip in the same layout pass so the
  // first painted frame already shows today centred (no flash of account start).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-day="${today}"]`);
    if (target) {
      el.scrollLeft =
        target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2;
    }
    setReady(true);
  }, [today]);

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="Check-in history"
      className={`no-scrollbar relative flex gap-2 overflow-x-auto pb-1 ${ready ? "" : "opacity-0"}`}
    >
      {days.map((day, i) => {
        const date = new Date(day);
        const d = date.getUTCDate();
        const dow = date.getUTCDay();
        const isToday = day === today;
        const isFuture = day > today;

        const recorded = statusByDay.get(day);
        const status = deriveDayStatus({
          recorded,
          day,
          today,
          isRestDay: restDays.includes(dow),
        });

        // Month label above the first cell of each new month.
        const showMonth = i === 0 || day.slice(5, 7) !== days[i - 1].slice(5, 7);

        return (
          <div key={day} data-day={day} className="flex shrink-0 flex-col items-center gap-0.5">
            <span className="h-3 text-[9px] uppercase tracking-wide text-white/35">
              {showMonth ? monthFmt.format(date) : ""}
            </span>
            <span className="text-[10px] text-white/40">{DOW[dow]}</span>
            <div
              role="img"
              aria-label={`${monthFmt.format(date)} ${d}${isToday ? " (today)" : ""}: ${humanStatus(status)}`}
              className={`flex h-[2.4rem] w-9 items-center justify-center rounded-full text-sm font-medium transition-all ${tone(
                status
              )} ${isToday ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
            >
              {d}
            </div>
          </div>
        );
      })}
    </div>
  );
}
