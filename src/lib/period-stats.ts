export type PeriodRecord = {
  local_day: string; // YYYY-MM-DD
  flow_level: "light" | "medium" | "heavy" | "unspecified";
};

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export type CycleSummary = {
  start: string;
  end: string;
  durationDays: number;
  // Days from this cycle's start to the next cycle's start. null for the
  // most recent cycle (no following cycle to measure against yet).
  cycleLengthDays: number | null;
};

export type Regularity = "regular" | "irregular" | "unknown";

export type PeriodStats = {
  lastPeriodStart: string | null;
  daysSinceLastPeriod: number | null;
  averageCycleDays: number | null;
  averageDurationDays: number | null;
  cyclesSampled: number;
  // Prediction: only set when we have ≥2 cycles to infer cycle length.
  nextPredictedStart: string | null;
  daysUntilPredicted: number | null;
  // Per-cycle breakdown, oldest → newest. Drives trends/history UI.
  cycles: CycleSummary[];
  // max − min of measured cycle lengths. null until ≥3 cycles (≥2 gaps).
  cycleLengthSpreadDays: number | null;
  regularity: Regularity;
  // 1-indexed day within the current (most recent) cycle. null when no data.
  currentCycleDay: number | null;
  currentPhase: CyclePhase | null;
};

function addDays(localDay: string, n: number): string {
  const [y, m, d] = localDay.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = Date.UTC(
    Number(a.slice(0, 4)),
    Number(a.slice(5, 7)) - 1,
    Number(a.slice(8, 10))
  );
  const db = Date.UTC(
    Number(b.slice(0, 4)),
    Number(b.slice(5, 7)) - 1,
    Number(b.slice(8, 10))
  );
  return Math.round((db - da) / 86_400_000);
}

/**
 * Rough estimate of the menstrual cycle phase for a given day. This is an
 * approximation for display only — not medical guidance.
 *
 *   - menstrual:  still within the logged period (cycleDay ≤ period duration)
 *   - ovulation:  ~14 days before the next expected period (±1 day window)
 *   - follicular: after the period, before ovulation
 *   - luteal:     after ovulation
 *
 * When the average cycle length is unknown we can only distinguish menstrual
 * from follicular.
 */
export function estimatePhase(
  cycleDay: number,
  periodDuration: number,
  avgCycle: number | null
): CyclePhase | null {
  if (cycleDay <= 0) return null;
  if (cycleDay <= periodDuration) return "menstrual";
  if (avgCycle == null) return "follicular";

  // Luteal phase is biologically ~14 days; ovulation sits cycleLength − 14.
  let ovulationDay = avgCycle - 14;
  // Guard short/atypical cycles so ovulation never lands inside the period.
  if (ovulationDay <= periodDuration) ovulationDay = Math.round(avgCycle / 2);

  if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) return "ovulation";
  if (cycleDay < ovulationDay) return "follicular";
  return "luteal";
}

/**
 * Group contiguous period-day records into cycles. A new cycle starts after a
 * gap of 2+ non-period days. Records must be sorted ascending by local_day.
 */
export function computePeriodStats(records: PeriodRecord[], today: string): PeriodStats {
  if (!records || records.length === 0) {
    return {
      lastPeriodStart: null,
      daysSinceLastPeriod: null,
      averageCycleDays: null,
      averageDurationDays: null,
      cyclesSampled: 0,
      nextPredictedStart: null,
      daysUntilPredicted: null,
      cycles: [],
      cycleLengthSpreadDays: null,
      regularity: "unknown",
      currentCycleDay: null,
      currentPhase: null,
    };
  }

  const sorted = [...records].sort((a, b) => a.local_day.localeCompare(b.local_day));

  type RawCycle = { start: string; end: string; durationDays: number };
  const raw: RawCycle[] = [];
  let curStart = sorted[0].local_day;
  let curEnd = sorted[0].local_day;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].local_day;
    const next = sorted[i].local_day;
    const gap = daysBetween(prev, next);
    if (gap <= 1) {
      // contiguous
      curEnd = next;
    } else {
      raw.push({ start: curStart, end: curEnd, durationDays: daysBetween(curStart, curEnd) + 1 });
      curStart = next;
      curEnd = next;
    }
  }
  raw.push({ start: curStart, end: curEnd, durationDays: daysBetween(curStart, curEnd) + 1 });

  // Attach cycle-length (gap to the next cycle's start) to each cycle.
  const cycles: CycleSummary[] = raw.map((c, i) => ({
    start: c.start,
    end: c.end,
    durationDays: c.durationDays,
    cycleLengthDays: i < raw.length - 1 ? daysBetween(c.start, raw[i + 1].start) : null,
  }));

  const last = cycles[cycles.length - 1];
  const daysSinceLastPeriod = daysBetween(last.end, today);

  // Measured cycle lengths = gaps between consecutive cycle starts.
  const gaps = cycles
    .map((c) => c.cycleLengthDays)
    .filter((n): n is number => n != null);

  let averageCycleDays: number | null = null;
  if (gaps.length >= 1) {
    averageCycleDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  // Spread (regularity) needs at least two measured cycle lengths.
  let cycleLengthSpreadDays: number | null = null;
  let regularity: Regularity = "unknown";
  if (gaps.length >= 2) {
    cycleLengthSpreadDays = Math.max(...gaps) - Math.min(...gaps);
    regularity = cycleLengthSpreadDays <= 4 ? "regular" : "irregular";
  }

  const averageDurationDays = Math.round(
    cycles.reduce((acc, c) => acc + c.durationDays, 0) / cycles.length
  );

  // Predict the next period by adding the average cycle length to the last
  // cycle's start. Only meaningful when we have ≥2 cycles.
  let nextPredictedStart: string | null = null;
  let daysUntilPredicted: number | null = null;
  if (averageCycleDays != null) {
    nextPredictedStart = addDays(last.start, averageCycleDays);
    daysUntilPredicted = daysBetween(today, nextPredictedStart);
  }

  // Current cycle position (day 1 = first day of the most recent cycle).
  const dayOffset = daysBetween(last.start, today);
  const currentCycleDay = dayOffset >= 0 ? dayOffset + 1 : null;
  const currentPhase =
    currentCycleDay != null
      ? estimatePhase(currentCycleDay, last.durationDays, averageCycleDays)
      : null;

  return {
    lastPeriodStart: last.start,
    daysSinceLastPeriod,
    averageCycleDays,
    averageDurationDays,
    cyclesSampled: cycles.length,
    nextPredictedStart,
    daysUntilPredicted,
    cycles,
    cycleLengthSpreadDays,
    regularity,
    currentCycleDay,
    currentPhase,
  };
}
