"use client";

import type React from "react";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PeriodDayEditor } from "@/components/progress-section";
import type { PeriodStats, CycleSummary } from "@/lib/period-stats";
import { PeriodSharingManager } from "./sharing";

type FlowLevel = "light" | "medium" | "heavy" | "unspecified";
type PeriodRecord = { local_day: string; flow_level: FlowLevel };

const PHASE_LABEL: Record<NonNullable<PeriodStats["currentPhase"]>, string> = {
  menstrual: "Menstrual",
  follicular: "Follicular",
  ovulation: "Ovulation",
  luteal: "Luteal",
};

const FLOW_LABEL: Record<FlowLevel, string> = {
  light: "Light flow",
  medium: "Medium flow",
  heavy: "Heavy flow",
  unspecified: "Had flow",
};

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function fmtShort(day: string): string {
  return new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtFull(day: string): string {
  return new Date(day).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Date strip ───────────────────────────────────────────────────────────────

function DateStrip({
  today,
  selectedDay,
  onSelect,
  flowByDay,
  predictedStart,
  predictedEnd,
}: {
  today: string;
  selectedDay: string;
  onSelect: (day: string) => void;
  flowByDay: Map<string, FlowLevel>;
  predictedStart: string | null;
  predictedEnd: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a 6-week window: 21 days back through 21 days forward
  const days = Array.from({ length: 43 }, (_, i) => addDays(today, i - 21));

  // Flow-level → pill background + ring + dot colour
  const FLOW_STYLE: Record<FlowLevel, { pill: string; ring: string; dot: string }> = {
    light:       { pill: "bg-rose-400/15", ring: "ring-1 ring-rose-300/30", dot: "bg-rose-300" },
    medium:      { pill: "bg-rose-500/30", ring: "ring-1 ring-rose-400/45", dot: "bg-rose-400" },
    heavy:       { pill: "bg-rose-600/50", ring: "ring-1 ring-rose-500/60", dot: "bg-rose-500" },
    unspecified: { pill: "bg-rose-400/20", ring: "ring-1 ring-rose-400/30", dot: "bg-rose-400/70" },
  };

  // Scroll selected day into centre on mount and whenever it changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-day="${selectedDay}"]`);
    if (target) {
      el.scrollLeft =
        target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2;
    }
  }, [selectedDay]);

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
    >
      {days.map((day) => {
        const isSelected = day === selectedDay;
        const isToday = day === today;
        const flow = flowByDay.get(day) ?? null;
        const isPeriod = flow != null;
        const isPredicted =
          !isPeriod &&
          predictedStart != null &&
          predictedEnd != null &&
          day >= predictedStart &&
          day <= predictedEnd;
        const date = new Date(day);
        const d = date.getUTCDate();
        const dow = DOW[date.getUTCDay()];
        const fs = flow ? FLOW_STYLE[flow] : null;

        return (
          <button
            key={day}
            data-day={day}
            type="button"
            onClick={() => onSelect(day)}
            className="flex shrink-0 flex-col items-center gap-0.5"
          >
            <span className="text-[10px] text-white/40">{dow}</span>
            <div
              className={`relative flex h-[2.6rem] w-9 items-center justify-center rounded-full transition-all ${
                isSelected
                  ? "bg-white text-black"
                  : isPeriod && fs
                    ? `${fs.pill} ${fs.ring} text-white`
                    : isPredicted
                      ? "border border-dashed border-rose-400/55 bg-rose-400/[0.06] text-rose-200/85"
                      : isToday
                        ? "border border-white/40 text-white"
                        : "text-white/55"
              }`}
            >
              <span className="text-sm font-medium leading-none">{d}</span>
              {/* Flow-level dot below number */}
              {isPeriod && !isSelected && fs ? (
                <span className={`absolute bottom-1 h-1 w-1 rounded-full ${fs.dot}`} />
              ) : isPredicted ? (
                <span className="absolute bottom-1 h-1 w-1 rounded-full border border-rose-400/65" />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Log section ──────────────────────────────────────────────────────────────

function LogSection({
  selectedDay,
  today,
  flowByDay,
  predictedStart,
  predictedEnd,
  onEdit,
  readonly = false,
}: {
  selectedDay: string;
  today: string;
  flowByDay: Map<string, FlowLevel>;
  predictedStart: string | null;
  predictedEnd: string | null;
  onEdit: (day: string) => void;
  readonly?: boolean;
}) {
  const isFuture = selectedDay > today;
  const flow = flowByDay.get(selectedDay) ?? null;
  const isPeriod = flow != null;
  const isPredicted =
    !isPeriod &&
    predictedStart != null &&
    predictedEnd != null &&
    selectedDay >= predictedStart &&
    selectedDay <= predictedEnd;
  // In readonly mode (viewing someone else's data) the period row is not tappable.
  const canEdit = !readonly && !isFuture;

  return (
    <section className="rounded-[2rem] glass-card px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Log</p>
        {isPeriod && canEdit ? (
          <button
            type="button"
            onClick={() => onEdit(selectedDay)}
            className="text-xs text-white/45 hover:text-white"
          >
            Edit
          </button>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {/* Bleeding / period row */}
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          <span className="text-xs font-medium text-rose-300">Bleeding</span>
        </div>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => canEdit && onEdit(selectedDay)}
          className={`flex w-full items-center justify-between rounded-[1.4rem] border px-4 py-3 text-left transition ${
            isPeriod
              ? "border-rose-500/30 bg-rose-500/10"
              : "border-white/10 bg-white/[0.03]"
          } ${canEdit ? "hover:bg-white/[0.06]" : "cursor-default"}`}
        >
          <span className={`text-sm font-medium ${isPeriod ? "text-white" : "text-white/40"}`}>
            Period
          </span>
          <span className={`text-sm ${isPeriod ? "text-rose-300 font-medium" : "text-white/25"}`}>
            {isPeriod
              ? FLOW_LABEL[flow]
              : isPredicted
                ? "Predicted"
                : isFuture
                  ? "—"
                  : readonly
                    ? "No data"
                    : "No data — tap to log"}
          </span>
        </button>
      </div>
    </section>
  );
}

// ─── Next period hero ───────────────────────────────────────────────────────

// Prominent prediction card shown at the top once enough cycles are logged.
// Returns null when no prediction is available (< 3 logged periods).
function NextPeriodHero({ stats }: { stats: PeriodStats }) {
  if (stats.nextPredictedStart == null || stats.daysUntilPredicted == null) {
    return null;
  }

  const days = stats.daysUntilPredicted;
  const headline =
    days < 0
      ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`
      : days === 0
        ? "Today"
        : `in ${days} day${days === 1 ? "" : "s"}`;

  const phase = stats.currentPhase ? PHASE_LABEL[stats.currentPhase] : null;
  const sub = [
    `Predicted ${fmtShort(stats.nextPredictedStart)}`,
    stats.currentCycleDay != null ? `cycle day ${stats.currentCycleDay}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-[2rem] border border-rose-500/20 bg-rose-500/[0.07] px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200/70">
            Next period
          </p>
          <p className="mt-1.5 text-3xl font-bold text-white">{headline}</p>
          <p className="mt-1 text-sm text-white/55">{sub}</p>
        </div>
        {phase ? (
          <span className="shrink-0 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200">
            {phase}
          </span>
        ) : null}
      </div>
    </section>
  );
}

// ─── Highlights ───────────────────────────────────────────────────────────────

// `excludePrediction` drops the Next-period and Cycle-day tiles when the
// NextPeriodHero is rendered above, so they aren't shown twice.
function Highlights({
  stats,
  excludePrediction = false,
}: {
  stats: PeriodStats;
  excludePrediction?: boolean;
}) {
  const phase = stats.currentPhase ? PHASE_LABEL[stats.currentPhase] : null;

  const items = [
    !excludePrediction &&
    stats.nextPredictedStart != null &&
    stats.daysUntilPredicted != null
      ? {
          label: "Next period",
          value: fmtShort(stats.nextPredictedStart),
          sub:
            stats.daysUntilPredicted < 0
              ? `${Math.abs(stats.daysUntilPredicted)}d late`
              : stats.daysUntilPredicted === 0
                ? "Today"
                : `In ${stats.daysUntilPredicted}d`,
        }
      : null,
    !excludePrediction && stats.currentCycleDay != null
      ? {
          label: "Cycle day",
          value: `Day ${stats.currentCycleDay}`,
          sub: phase ?? "—",
        }
      : null,
    {
      label: "Avg cycle",
      value: stats.averageCycleDays != null ? `${stats.averageCycleDays}d` : "—",
      sub:
        stats.averageCycleDays != null
          ? `${stats.cyclesSampled} cycles`
          : stats.cyclesSampled === 0
            ? "log 2 periods"
            : "1 more period needed",
    },
    {
      label: "Avg duration",
      value: stats.averageDurationDays != null ? `${stats.averageDurationDays}d` : "—",
      sub:
        stats.regularity === "regular"
          ? "Regular"
          : stats.regularity === "irregular"
            ? "Variable"
            : "—",
    },
  ].filter(Boolean) as Array<{ label: string; value: string; sub: string }>;

  if (items.length === 0) return null;

  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
        Highlights
      </p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-[1.7rem] glass-card p-4"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">{item.label}</p>
            <p className="mt-1 truncate text-xl font-bold text-white">{item.value}</p>
            <p className="mt-0.5 text-xs text-white/40">{item.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Trends ───────────────────────────────────────────────────────────────────

function Trends({
  cycles,
  averageCycleDays,
}: {
  cycles: CycleSummary[];
  averageCycleDays: number | null;
}) {
  const recent = cycles.slice(-8);
  const lengthBars = recent
    .filter((c) => c.cycleLengthDays != null)
    .map((c) => ({ label: fmtShort(c.start), value: c.cycleLengthDays as number }));
  const durationBars = recent.map((c) => ({ label: fmtShort(c.start), value: c.durationDays }));

  if (durationBars.length < 1) return null;

  return (
    <section className="rounded-[2rem] glass-card px-5 py-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Trends</p>
      <div className="space-y-5">
        {lengthBars.length >= 2 ? (
          <BarChart title="Cycle length (days)" bars={lengthBars} referenceValue={averageCycleDays} />
        ) : (
          <p className="text-xs text-white/35">Cycle-length trend needs 3 logged periods.</p>
        )}
        <BarChart title="Period duration (days)" bars={durationBars} referenceValue={null} />
      </div>
    </section>
  );
}

function BarChart({
  title,
  bars,
  referenceValue,
}: {
  title: string;
  bars: Array<{ label: string; value: number }>;
  referenceValue: number | null;
}) {
  const max = Math.max(...bars.map((b) => b.value), referenceValue ?? 0, 1);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{title}</p>
        {referenceValue != null ? (
          <p className="text-[10px] text-white/35">avg {referenceValue}d</p>
        ) : null}
      </div>
      <div className="relative flex h-16 items-end gap-1.5">
        {referenceValue != null ? (
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-white/20"
            style={{ bottom: `${(referenceValue / max) * 100}%` }}
            aria-hidden
          />
        ) : null}
        {bars.map((b, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="mb-0.5 text-[9px] text-white/40">{b.value}</span>
            <div
              className="w-full rounded-t bg-rose-400/60"
              style={{ height: `${Math.max((b.value / max) * 100, 4)}%` }}
              title={`${b.label}: ${b.value}d`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {bars.map((b, i) => (
          <span key={i} className="min-w-0 flex-1 truncate text-center text-[8px] text-white/30">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main CycleView export ────────────────────────────────────────────────────

export function CycleView({
  today,
  stats,
  records,
  readonly = false,
}: {
  today: string;
  stats: PeriodStats;
  records: PeriodRecord[];
  // Read-only view (e.g. a grantee viewing someone else's cycle data):
  // hides editing affordances and the sharing manager.
  readonly?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedDay, setSelectedDay] = useState(today);
  const [editingDay, setEditingDay] = useState<string | null>(null);

  const flowByDay = new Map(records.map((r) => [r.local_day, r.flow_level]));

  // Predicted period window: from nextPredictedStart through +avgDuration days
  const predictedStart = stats.nextPredictedStart;
  const predictedEnd =
    predictedStart && stats.averageDurationDays
      ? addDays(predictedStart, stats.averageDurationDays - 1)
      : predictedStart;

  const hasPrediction =
    stats.nextPredictedStart != null && stats.daysUntilPredicted != null;

  return (
    <div className="space-y-5">
      {/* Selected date heading */}
      <div>
        <p className="text-2xl font-semibold text-white">{fmtFull(selectedDay)}</p>
      </div>

      {/* Next period prediction hero */}
      <div className="animate-fade-up-item" style={{ "--stagger": "40ms" } as React.CSSProperties}>
        <NextPeriodHero stats={stats} />
      </div>

      {/* Date strip */}
      <div className="animate-fade-up-item" style={{ "--stagger": "90ms" } as React.CSSProperties}>
      <DateStrip
        today={today}
        selectedDay={selectedDay}
        onSelect={setSelectedDay}
        flowByDay={flowByDay}
        predictedStart={predictedStart}
        predictedEnd={predictedEnd ?? null}
      />
      </div>

      {/* Log section */}
      <div className="animate-fade-up-item" style={{ "--stagger": "140ms" } as React.CSSProperties}>
      <LogSection
        selectedDay={selectedDay}
        today={today}
        flowByDay={flowByDay}
        predictedStart={predictedStart}
        predictedEnd={predictedEnd ?? null}
        onEdit={(day) => setEditingDay(day)}
        readonly={readonly}
      />
      </div>

      {/* Highlights grid */}
      <div className="animate-fade-up-item" style={{ "--stagger": "190ms" } as React.CSSProperties}>
        <Highlights stats={stats} excludePrediction={hasPrediction} />
      </div>

      {/* Trends */}
      <div className="animate-fade-up-item" style={{ "--stagger": "240ms" } as React.CSSProperties}>
        <Trends cycles={stats.cycles} averageCycleDays={stats.averageCycleDays} />
      </div>

      {/* Sharing manager — owner only (hidden in readonly grantee view) */}
      {!readonly ? <PeriodSharingManager /> : null}

      <p className="text-center text-xs text-white/30">
        Predictions are estimates — not medical advice.
      </p>

      {/* Period day editor modal — disabled in readonly mode */}
      {!readonly && editingDay ? (
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
    </div>
  );
}
