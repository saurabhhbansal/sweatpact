export type PeriodRecord = {
  local_day: string; // YYYY-MM-DD
  flow_level: "light" | "medium" | "heavy" | "unspecified";
};

export type PeriodStats = {
  lastPeriodStart: string | null;
  daysSinceLastPeriod: number | null;
  averageCycleDays: number | null;
  averageDurationDays: number | null;
  cyclesSampled: number;
  // Prediction: only set when we have ≥2 cycles to infer cycle length.
  nextPredictedStart: string | null;
  daysUntilPredicted: number | null;
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
    };
  }

  const sorted = [...records].sort((a, b) => a.local_day.localeCompare(b.local_day));

  type Cycle = { start: string; end: string; durationDays: number };
  const cycles: Cycle[] = [];
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
      cycles.push({ start: curStart, end: curEnd, durationDays: daysBetween(curStart, curEnd) + 1 });
      curStart = next;
      curEnd = next;
    }
  }
  cycles.push({ start: curStart, end: curEnd, durationDays: daysBetween(curStart, curEnd) + 1 });

  const last = cycles[cycles.length - 1];
  const daysSinceLastPeriod = daysBetween(last.end, today);

  // Average cycle length = distance between consecutive cycle starts.
  let averageCycleDays: number | null = null;
  if (cycles.length >= 2) {
    let total = 0;
    for (let i = 1; i < cycles.length; i++) {
      total += daysBetween(cycles[i - 1].start, cycles[i].start);
    }
    averageCycleDays = Math.round(total / (cycles.length - 1));
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

  return {
    lastPeriodStart: last.start,
    daysSinceLastPeriod,
    averageCycleDays,
    averageDurationDays,
    cyclesSampled: cycles.length,
    nextPredictedStart,
    daysUntilPredicted,
  };
}
