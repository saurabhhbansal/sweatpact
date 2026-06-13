export type PeriodRecord = {
  local_day: string; // YYYY-MM-DD
  flow_level: "light" | "medium" | "heavy" | "unspecified";
};

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export type CycleSummary = {
  start: string;
  end: string;
  // Span from start to end, inclusive. May include a single tolerated gap day.
  durationDays: number;
  // Count of days actually logged in this episode (≤ durationDays).
  loggedFlowDays: number;
  // Days from this cycle's start to the next cycle's start. null for the
  // most recent cycle (no following cycle to measure against yet).
  cycleLengthDays: number | null;
};

export type Regularity = "regular" | "irregular" | "unknown";

export type PeriodStats = {
  lastPeriodStart: string | null;
  // Days since the last bleeding ended (end-based). Retained for completeness.
  daysSinceLastPeriod: number | null;
  // Days since the last period *started*. This is what UIs should show.
  daysSinceLastPeriodStart: number | null;
  averageCycleDays: number | null;
  averageDurationDays: number | null;
  cyclesSampled: number;
  // Prediction: set once we have ≥1 plausible measured gap (≥2 starts).
  nextPredictedStart: string | null;
  daysUntilPredicted: number | null;
  // True when the prediction is materially overdue (user likely stopped logging
  // or is late). Phase and currentCycleDay are suppressed in this state.
  isOverdue: boolean;
  // Per-cycle breakdown, oldest → newest. Drives trends/history UI.
  cycles: CycleSummary[];
  // max − min of plausible measured cycle lengths. null until ≥2 valid gaps.
  cycleLengthSpreadDays: number | null;
  regularity: Regularity;
  // 1-indexed day within the current (most recent) cycle. null when no data or
  // when overdue.
  currentCycleDay: number | null;
  currentPhase: CyclePhase | null;
};

// Plausible cycle-length window (days). Gaps outside this range are treated as
// tracking artifacts, not real cycles, and excluded from averages/regularity.
const MIN_CYCLE = 15;
const MAX_CYCLE = 90;

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
  // All inputs are UTC-midnight local-day strings, so this is exact integer days.
  return Math.trunc((db - da) / 86_400_000);
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

// Median absolute deviation — a robust spread measure insensitive to outliers.
// Used as the regularity gate so a single off cycle doesn't flip the label.
function mad(values: number[]): number {
  const med = median(values);
  return median(values.map((v) => Math.abs(v - med)));
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
 * When the average cycle length is unknown we can only confirm the menstrual
 * phase (while bleeding); past that we return null rather than guess.
 */
export function estimatePhase(
  cycleDay: number,
  periodDuration: number,
  avgCycle: number | null
): CyclePhase | null {
  if (cycleDay <= 0) return null;
  if (cycleDay <= periodDuration) return "menstrual";
  // Without an average cycle length we can't place ovulation/luteal honestly.
  if (avgCycle == null) return null;

  // Luteal phase is biologically ~14 days; ovulation sits cycleLength − 14.
  let ovulationDay = avgCycle - 14;
  // Guard short/atypical cycles so ovulation never lands inside the period.
  if (ovulationDay <= periodDuration) ovulationDay = Math.round(avgCycle / 2);

  if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) return "ovulation";
  if (cycleDay < ovulationDay) return "follicular";
  return "luteal";
}

function emptyStats(): PeriodStats {
  return {
    lastPeriodStart: null,
    daysSinceLastPeriod: null,
    daysSinceLastPeriodStart: null,
    averageCycleDays: null,
    averageDurationDays: null,
    cyclesSampled: 0,
    nextPredictedStart: null,
    daysUntilPredicted: null,
    isOverdue: false,
    cycles: [],
    cycleLengthSpreadDays: null,
    regularity: "unknown",
    currentCycleDay: null,
    currentPhase: null,
  };
}

/**
 * Group contiguous period-day records into cycles. A single skipped logging day
 * is tolerated (days ≤2 apart stay in one episode); a larger gap starts a new
 * cycle. Records are deduped by day and future-dated rows are dropped.
 */
export function computePeriodStats(records: PeriodRecord[], today: string): PeriodStats {
  if (!records || records.length === 0) return emptyStats();

  // Normalize: dedupe by local_day, drop future records, sort ascending.
  const seen = new Set<string>();
  const sorted = records
    .filter((r) => r.local_day <= today)
    .filter((r) => (seen.has(r.local_day) ? false : (seen.add(r.local_day), true)))
    .sort((a, b) => a.local_day.localeCompare(b.local_day));

  if (sorted.length === 0) return emptyStats();

  type RawCycle = { start: string; end: string; durationDays: number; loggedFlowDays: number };
  const raw: RawCycle[] = [];
  let curStart = sorted[0].local_day;
  let curEnd = sorted[0].local_day;
  let curLogged = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].local_day;
    const next = sorted[i].local_day;
    const gap = daysBetween(prev, next);
    // Tolerate a single skipped logging day within one bleeding episode.
    if (gap <= 2) {
      curEnd = next;
      curLogged++;
    } else {
      raw.push({
        start: curStart,
        end: curEnd,
        durationDays: daysBetween(curStart, curEnd) + 1,
        loggedFlowDays: curLogged,
      });
      curStart = next;
      curEnd = next;
      curLogged = 1;
    }
  }
  raw.push({
    start: curStart,
    end: curEnd,
    durationDays: daysBetween(curStart, curEnd) + 1,
    loggedFlowDays: curLogged,
  });

  // Attach cycle-length (gap to the next cycle's start) to each cycle.
  const cycles: CycleSummary[] = raw.map((c, i) => ({
    start: c.start,
    end: c.end,
    durationDays: c.durationDays,
    loggedFlowDays: c.loggedFlowDays,
    cycleLengthDays: i < raw.length - 1 ? daysBetween(c.start, raw[i + 1].start) : null,
  }));

  const last = cycles[cycles.length - 1];
  const daysSinceLastPeriod = daysBetween(last.end, today);
  const daysSinceLastPeriodStart = daysBetween(last.start, today);

  // Plausible measured cycle lengths = gaps between consecutive starts that
  // fall in a physiologically reasonable window.
  const validGaps = cycles
    .map((c) => c.cycleLengthDays)
    .filter((n): n is number => n != null && n >= MIN_CYCLE && n <= MAX_CYCLE);

  // Predict once there is ≥1 plausible measured gap (≥2 period starts). With a
  // single gap the "average" is that one observed cycle — less certain, but
  // enough to give an early prediction. Regularity/spread still need more data.
  let averageCycleDays: number | null = null;
  if (validGaps.length >= 1) {
    averageCycleDays = Math.round(validGaps.reduce((a, b) => a + b, 0) / validGaps.length);
  }

  // Regularity uses robust spread over ≥3 valid gaps so one outlier can't flip it.
  let cycleLengthSpreadDays: number | null = null;
  let regularity: Regularity = "unknown";
  if (validGaps.length >= 2) {
    cycleLengthSpreadDays = Math.max(...validGaps) - Math.min(...validGaps);
  }
  if (validGaps.length >= 3) {
    // Robust spread (MAD) so a lone outlier cycle doesn't flip the label.
    regularity = mad(validGaps) <= 2.5 ? "regular" : "irregular";
  }

  const averageDurationDays = Math.round(
    cycles.reduce((acc, c) => acc + c.durationDays, 0) / cycles.length
  );

  // Predict the next period by adding the average cycle length to the last
  // cycle's start. Only meaningful when we have ≥2 valid gaps.
  let nextPredictedStart: string | null = null;
  let daysUntilPredicted: number | null = null;
  let isOverdue = false;
  if (averageCycleDays != null) {
    nextPredictedStart = addDays(last.start, averageCycleDays);
    daysUntilPredicted = daysBetween(today, nextPredictedStart);
    const overdueBy = daysBetween(nextPredictedStart, today);
    isOverdue = overdueBy > Math.max(14, Math.round(averageCycleDays * 0.5));
  }

  // Current cycle position (day 1 = first day of the most recent cycle). When
  // overdue we suppress both the day count and the phase rather than report a
  // runaway number / unreliable phase.
  let currentCycleDay: number | null = null;
  let currentPhase: CyclePhase | null = null;
  if (!isOverdue) {
    const dayOffset = daysBetween(last.start, today);
    currentCycleDay = dayOffset >= 0 ? dayOffset + 1 : null;
    currentPhase =
      currentCycleDay != null
        ? estimatePhase(currentCycleDay, last.durationDays, averageCycleDays)
        : null;
  }

  return {
    lastPeriodStart: last.start,
    daysSinceLastPeriod,
    daysSinceLastPeriodStart,
    averageCycleDays,
    averageDurationDays,
    cyclesSampled: cycles.length,
    nextPredictedStart,
    daysUntilPredicted,
    isOverdue,
    cycles,
    cycleLengthSpreadDays,
    regularity,
    currentCycleDay,
    currentPhase,
  };
}
