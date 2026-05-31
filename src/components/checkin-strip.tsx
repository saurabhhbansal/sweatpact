"use client";

import { useEffect, useRef } from "react";

type HistoryEntry = { local_day: string; status: string };

const DOW = ["S", "M", "T", "W", "T", "F", "S"]; // index = getUTCDay() (0=Sun)
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short" });

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// Sunday that ends the ISO week (Mon–Sun) containing `day`.
function isoWeekSunday(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dowMon = (date.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  date.setUTCDate(date.getUTCDate() + (6 - dowMon));
  return date.toISOString().slice(0, 10);
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
    default: // future / pending
      return "text-white/30";
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

  const statusByDay = new Map<string, string>();
  for (const row of history) statusByDay.set(row.local_day, row.status);

  // Build the day list: account creation → end of the current ISO week.
  const start = startDay <= today ? startDay : today;
  const end = isoWeekSunday(today);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
    if (days.length > 800) break; // safety cap (~2 years)
  }

  // Scroll today into view on mount.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-day="${today}"]`);
    if (target) {
      el.scrollLeft =
        target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2;
    }
  }, [today]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {days.map((day, i) => {
        const date = new Date(day);
        const d = date.getUTCDate();
        const dow = date.getUTCDay();
        const isToday = day === today;
        const isFuture = day > today;

        const recorded = statusByDay.get(day);
        const status =
          recorded ?? (isFuture ? "future" : restDays.includes(dow) ? "rest_day" : "pending");

        // Month label above the first cell of each new month.
        const showMonth = i === 0 || day.slice(5, 7) !== days[i - 1].slice(5, 7);

        return (
          <div key={day} className="flex shrink-0 flex-col items-center gap-0.5">
            <span className="h-3 text-[9px] uppercase tracking-wide text-white/35">
              {showMonth ? monthFmt.format(date) : ""}
            </span>
            <span className="text-[10px] text-white/40">{DOW[dow]}</span>
            <div
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
