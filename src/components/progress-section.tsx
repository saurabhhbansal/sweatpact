"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

type DayEntry = { local_day: string; status: string };
type WeekDot = { key: string; label: string; current: boolean; status: string };
type PeriodRecord = { local_day: string; flow_level: "light" | "medium" | "heavy" | "unspecified" };

const monthHeaderFmt = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});

// Mo, Tu, We, Th, Fr, Sa, Su
const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function dotTone(status: string) {
  if (status === "verified") {
    return "bg-emerald-500/90 text-black";
  }
  if (status === "unverified") {
    return "border-dashed border-emerald-400 bg-transparent text-emerald-300";
  }
  if (status === "missed" || status === "rejected") {
    return "border-solid border-red-500/70 bg-red-500/15 text-red-300";
  }
  if (["sick_day", "gym_closed", "rest_day", "period_day"].includes(status)) {
    return "border-solid border-white/20 bg-white/[0.06] text-white/55";
  }
  return "border-solid border-white/10 bg-transparent text-white/30";
}

function dotSymbol(status: string) {
  if (status === "verified") return "✓";
  if (status === "unverified") return "✓";
  if (status === "missed" || status === "rejected") return "×";
  if (["sick_day", "gym_closed", "rest_day", "period_day"].includes(status)) return "•";
  return "·";
}

type MonthGrid = {
  year: number;
  monthIdx: number; // 0-11
  label: string;
  cells: Array<{ day: number; key: string; status: string; isToday: boolean } | null>;
};

function buildMonthGrid(
  year: number,
  monthIdx: number,
  statusByDay: Map<string, string>,
  today: string
): MonthGrid {
  const firstDay = new Date(Date.UTC(year, monthIdx, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  // Mon=0 ... Sun=6
  const firstDow = (firstDay.getUTCDay() + 6) % 7;

  const cells: MonthGrid["cells"] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const recorded = statusByDay.get(key);
    const status = recorded ?? (key > today ? "future" : "pending");
    cells.push({ day: d, key, status, isToday: key === today });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const label = monthHeaderFmt.format(firstDay);
  return { year, monthIdx, label, cells };
}

function nextMonth(year: number, monthIdx: number): { year: number; monthIdx: number } {
  if (monthIdx === 11) return { year: year + 1, monthIdx: 0 };
  return { year, monthIdx: monthIdx + 1 };
}

const FLOW_DOT_COUNT: Record<"light" | "medium" | "heavy" | "unspecified", number> = {
  light: 1,
  medium: 2,
  heavy: 3,
  unspecified: 1,
};

export function ProgressSection({
  weekDots,
  fullHistory,
  today,
  todayStatus,
  thisWeekCheckins,
  weeklyGoal,
  periodRecords = [],
  canEditPeriod = false,
  calendarOnly = false,
}: {
  weekDots: WeekDot[];
  fullHistory: DayEntry[];
  today: string;
  todayStatus: string;
  thisWeekCheckins: number;
  weeklyGoal: number;
  periodRecords?: PeriodRecord[];
  canEditPeriod?: boolean;
  // When true, hides the weekly gym summary + week dots and shows only the
  // month calendar (always expanded). Used by the Cycle tab for period logging.
  calendarOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const flowByDay = new Map<string, PeriodRecord["flow_level"]>();
  for (const r of periodRecords) flowByDay.set(r.local_day, r.flow_level);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl">
      {calendarOnly ? (
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-white/45">Calendar</p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">This week</p>
              <p className="mt-0.5 text-xs">
                <span className={thisWeekCheckins >= weeklyGoal ? "font-semibold text-white" : "text-white/80"}>
                  {thisWeekCheckins}
                </span>
                <span className="text-white/35">/{weeklyGoal}</span>
                {thisWeekCheckins >= weeklyGoal ? (
                  <span className="ml-1.5 text-white/75">goal met</span>
                ) : (
                  <span className="ml-1.5 text-white/35">days done</span>
                )}
              </p>
            </div>
            <StatusBadge status={todayStatus} />
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDots.map((dot) => (
              <div key={dot.key} className="text-center">
                <div
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 text-base ${dotTone(dot.status)} ${
                    dot.current ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""
                  }`}
                >
                  {dotSymbol(dot.status)}
                </div>
                <p className="mt-1 text-xs text-white/50">{dot.label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {expanded || calendarOnly ? (() => {
        const statusByDay = new Map<string, string>();
        let earliest: string | null = null;
        for (const row of fullHistory) {
          statusByDay.set(row.local_day, row.status);
          if (!earliest || row.local_day < earliest) earliest = row.local_day;
        }
        const [ty, tm] = today.split("-").map(Number);
        // Start from the earliest month in history (or current month if no history)
        // and walk forward to the current month — chronological order.
        const startKey = earliest ?? today;
        const [sy, sm] = startKey.split("-").map(Number);
        let cursor = { year: sy, monthIdx: sm - 1 };
        const endYear = ty;
        const endMonthIdx = tm - 1;
        const months: MonthGrid[] = [];
        // Safety cap of 24 months to avoid pathological loops.
        for (let i = 0; i < 24; i++) {
          months.push(buildMonthGrid(cursor.year, cursor.monthIdx, statusByDay, today));
          if (cursor.year === endYear && cursor.monthIdx === endMonthIdx) break;
          cursor = nextMonth(cursor.year, cursor.monthIdx);
        }

        return (
          <div className="mt-4 space-y-5 border-t border-white/10 pt-4">
            {months.map((month) => (
              <div key={`${month.year}-${month.monthIdx}`}>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/55">
                  {month.label}
                </p>
                <div className="mb-1 grid grid-cols-7 gap-1.5">
                  {DOW_LABELS.map((label, i) => (
                    <span
                      key={i}
                      className="text-center text-[10px] uppercase text-white/30"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {month.cells.map((cell, i) => {
                    if (!cell) return <div key={`empty-${i}`} className="h-9 w-full" />;
                    const isFuture = cell.status === "future";
                    const flow = flowByDay.get(cell.key);
                    const dotCount = flow ? FLOW_DOT_COUNT[flow] : 0;
                    const editable =
                      canEditPeriod &&
                      !isFuture &&
                      cell.status !== "verified" &&
                      cell.status !== "unverified";
                    const inner = (
                      <>
                        <div
                          title={`${cell.key} · ${cell.status}${flow ? ` · ${flow}` : ""}`}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium ${
                            isFuture
                              ? "border-transparent text-white/25"
                              : dotTone(cell.status)
                          } ${
                            cell.isToday
                              ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                              : ""
                          }`}
                        >
                          {cell.day}
                        </div>
                        {dotCount > 0 ? (
                          <div className="pointer-events-none absolute -bottom-0.5 left-1/2 flex -translate-x-1/2 gap-[2px]">
                            {Array.from({ length: dotCount }).map((_, j) => (
                              <span key={j} className="h-1 w-1 rounded-full bg-white" />
                            ))}
                          </div>
                        ) : null}
                      </>
                    );
                    return editable ? (
                      <button
                        type="button"
                        key={cell.key}
                        onClick={() => setEditingDay(cell.key)}
                        className="relative mx-auto h-9 w-9 rounded-full transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                        aria-label={`Mark ${cell.key} as period day`}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div key={cell.key} className="relative mx-auto h-9 w-9">
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })() : null}

      {calendarOnly ? null : (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-3 flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-4 py-1.5 text-xs text-white/55 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {expanded ? "Show less" : "View calendar"}
        </button>
      )}

      {editingDay ? (
        <PeriodDayEditor
          day={editingDay}
          currentFlow={flowByDay.get(editingDay) ?? null}
          onClose={() => setEditingDay(null)}
          onSaved={() => {
            setEditingDay(null);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
    </section>
  );
}

export function PeriodDayEditor({
  day,
  currentFlow,
  onClose,
  onSaved,
}: {
  day: string;
  currentFlow: "light" | "medium" | "heavy" | "unspecified" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function save(flow: "light" | "medium" | "heavy") {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/period-records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ local_day: day, flow_level: flow }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed to save.");
      return;
    }
    onSaved();
  }

  async function remove() {
    setBusy(true);
    setErr(null);
    const res = await fetch(
      `/api/period-records?local_day=${encodeURIComponent(day)}`,
      { method: "DELETE" }
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed to remove.");
      return;
    }
    onSaved();
  }

  if (!mounted) return null;

  const niceDate = new Date(day).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-editor-title"
      className="animate-overlay-in fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-xl sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
      }}
    >
      <div
        className="animate-sheet-in w-full max-w-md rounded-t-[2rem] border border-white/15 bg-[#0a0a0a] p-5 sm:rounded-[2rem]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
        <div className="mb-1 flex items-center justify-between">
          <p id="period-editor-title" className="text-sm font-semibold text-white">{niceDate}</p>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-3 py-1.5 text-xs text-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Close
          </button>
        </div>
        <p className="mb-4 text-xs text-white/55">
          {currentFlow ? `Currently logged as ${currentFlow}.` : "Mark this day as a period day."}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant={currentFlow === "light" ? "default" : "secondary"}
            onClick={() => save("light")}
            disabled={busy}
            className="rounded-full"
          >
            Light
          </Button>
          <Button
            type="button"
            variant={currentFlow === "medium" ? "default" : "secondary"}
            onClick={() => save("medium")}
            disabled={busy}
            className="rounded-full"
          >
            Medium
          </Button>
          <Button
            type="button"
            variant={currentFlow === "heavy" ? "default" : "secondary"}
            onClick={() => save("heavy")}
            disabled={busy}
            className="rounded-full"
          >
            Heavy
          </Button>
        </div>
        {currentFlow ? (
          <Button
            type="button"
            variant="destructive"
            onClick={remove}
            disabled={busy}
            className="mt-3 w-full rounded-full"
          >
            Remove period day
          </Button>
        ) : null}
        {err ? <p role="alert" className="mt-3 text-center text-xs text-destructive">{err}</p> : null}
      </div>
    </div>,
    document.body
  );
}
