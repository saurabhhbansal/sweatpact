import { describe, it, expect } from "vitest";
import { computePeriodStats, estimatePhase, type PeriodRecord } from "./period-stats";

/** Build N consecutive period-day records starting at `start` (YYYY-MM-DD). */
function block(start: string, days: number): PeriodRecord[] {
  const [y, m, d] = start.split("-").map(Number);
  const out: PeriodRecord[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.UTC(y, m - 1, d + i));
    out.push({ local_day: date.toISOString().slice(0, 10), flow_level: "medium" });
  }
  return out;
}

describe("computePeriodStats", () => {
  it("returns empty/null stats for no records", () => {
    const s = computePeriodStats([], "2026-05-01");
    expect(s.cyclesSampled).toBe(0);
    expect(s.lastPeriodStart).toBeNull();
    expect(s.averageCycleDays).toBeNull();
    expect(s.nextPredictedStart).toBeNull();
    expect(s.cycles).toEqual([]);
    expect(s.regularity).toBe("unknown");
    expect(s.currentCycleDay).toBeNull();
    expect(s.currentPhase).toBeNull();
    expect(s.isOverdue).toBe(false);
    expect(s.daysSinceLastPeriodStart).toBeNull();
  });

  it("treats a single logged day as a one-day cycle with no prediction", () => {
    const s = computePeriodStats(block("2026-05-01", 1), "2026-05-01");
    expect(s.cyclesSampled).toBe(1);
    expect(s.cycles[0].durationDays).toBe(1);
    expect(s.cycles[0].loggedFlowDays).toBe(1);
    expect(s.cycles[0].cycleLengthDays).toBeNull();
    expect(s.averageCycleDays).toBeNull();
    expect(s.nextPredictedStart).toBeNull();
    expect(s.currentCycleDay).toBe(1);
    expect(s.currentPhase).toBe("menstrual");
    expect(s.regularity).toBe("unknown");
  });

  it("groups consecutive days into one cycle", () => {
    const s = computePeriodStats(block("2026-05-01", 5), "2026-05-06");
    expect(s.cyclesSampled).toBe(1);
    expect(s.cycles[0]).toMatchObject({
      start: "2026-05-01",
      end: "2026-05-05",
      durationDays: 5,
      loggedFlowDays: 5,
    });
    expect(s.averageDurationDays).toBe(5);
  });

  it("tolerates a single skipped logging day within one episode", () => {
    // 05-01, [05-02 missing], 05-03 — gap of 2 stays in one bleeding episode.
    const records: PeriodRecord[] = [
      { local_day: "2026-05-01", flow_level: "medium" },
      { local_day: "2026-05-03", flow_level: "medium" },
    ];
    const s = computePeriodStats(records, "2026-05-03");
    expect(s.cyclesSampled).toBe(1);
    expect(s.cycles[0]).toMatchObject({
      start: "2026-05-01",
      end: "2026-05-03",
      durationDays: 3, // span includes the tolerated gap day
      loggedFlowDays: 2, // but only 2 days were actually logged
    });
  });

  it("starts a new cycle on a realistic multi-week gap", () => {
    const records = [...block("2026-04-01", 5), ...block("2026-04-29", 5)];
    const s = computePeriodStats(records, "2026-05-10");
    expect(s.cyclesSampled).toBe(2);
    expect(s.cycles[0].cycleLengthDays).toBe(28); // 04-01 → 04-29
  });

  it("predicts from a single measured gap (2 starts)", () => {
    const records = [...block("2026-04-01", 1), ...block("2026-04-29", 1)];
    const s = computePeriodStats(records, "2026-05-10");
    expect(s.cyclesSampled).toBe(2);
    expect(s.averageCycleDays).toBe(28); // the one observed gap
    expect(s.nextPredictedStart).toBe("2026-05-27"); // 04-29 + 28
    expect(s.daysUntilPredicted).toBe(17); // 05-10 → 05-27
    // Regularity and spread still need more cycles.
    expect(s.regularity).toBe("unknown");
    expect(s.cycleLengthSpreadDays).toBeNull();
  });

  it("computes average and predicts once there are 3 starts (2 gaps)", () => {
    const records = [
      ...block("2026-04-01", 1),
      ...block("2026-04-29", 1),
      ...block("2026-05-27", 1),
    ];
    const s = computePeriodStats(records, "2026-05-30");
    expect(s.cyclesSampled).toBe(3);
    expect(s.averageCycleDays).toBe(28); // gaps [28, 28]
    expect(s.nextPredictedStart).toBe("2026-06-24"); // 05-27 + 28
    expect(s.daysUntilPredicted).toBe(25); // 05-30 → 06-24
    expect(s.isOverdue).toBe(false);
  });

  it("filters implausible gaps out of the average", () => {
    // 200-day gap is too long to be a real cycle; the two 28-day gaps remain.
    const records = [
      ...block("2026-01-01", 1),
      ...block("2026-07-20", 1), // ~200 days later → dropped
      ...block("2026-08-17", 1), // +28
      ...block("2026-09-14", 1), // +28
    ];
    const s = computePeriodStats(records, "2026-09-20");
    // valid gaps are the two 28s (the long Jan→Jul gap is excluded)
    expect(s.averageCycleDays).toBe(28);
    expect(s.nextPredictedStart).toBe("2026-10-12"); // 09-14 + 28
  });

  it("suppresses phase and cycle-day when overdue, but keeps the prediction", () => {
    const records = [
      ...block("2026-01-01", 1),
      ...block("2026-01-29", 1),
      ...block("2026-02-26", 1),
    ];
    const s = computePeriodStats(records, "2026-06-01");
    expect(s.averageCycleDays).toBe(28);
    expect(s.nextPredictedStart).toBe("2026-03-26"); // 02-26 + 28, long past
    expect(s.isOverdue).toBe(true);
    expect(s.currentPhase).toBeNull();
    expect(s.currentCycleDay).toBeNull();
  });

  it("labels tight cycle lengths as regular (≥3 valid gaps)", () => {
    // starts: 01-01, +28, +27, +29 → gaps [28, 27, 29]
    const records = [
      ...block("2026-01-01", 1),
      ...block("2026-01-29", 1),
      ...block("2026-02-25", 1),
      ...block("2026-03-26", 1),
    ];
    const s = computePeriodStats(records, "2026-04-01");
    expect(s.cyclesSampled).toBe(4);
    expect(s.regularity).toBe("regular");
    expect(s.cycleLengthSpreadDays).toBe(2); // 29 − 27
  });

  it("does not flip to irregular on a single outlier cycle", () => {
    // gaps [28, 29, 60] — one long outlier; MAD stays small → regular.
    const records = [
      ...block("2026-01-01", 1),
      ...block("2026-01-29", 1), // +28
      ...block("2026-02-27", 1), // +29
      ...block("2026-04-28", 1), // +60
    ];
    const s = computePeriodStats(records, "2026-05-01");
    expect(s.cyclesSampled).toBe(4);
    expect(s.regularity).toBe("regular");
  });

  it("labels genuinely varying cycle lengths as irregular", () => {
    // gaps [21, 35, 28] — spread out around the median → MAD large.
    const records = [
      ...block("2026-01-01", 1),
      ...block("2026-01-22", 1), // +21
      ...block("2026-02-26", 1), // +35
      ...block("2026-03-26", 1), // +28
    ];
    const s = computePeriodStats(records, "2026-04-01");
    expect(s.cyclesSampled).toBe(4);
    expect(s.regularity).toBe("irregular");
  });

  it("keeps regularity unknown with fewer than 3 valid gaps", () => {
    const records = [
      ...block("2026-03-04", 1),
      ...block("2026-04-01", 1),
      ...block("2026-04-29", 1),
    ];
    const s = computePeriodStats(records, "2026-05-01");
    expect(s.cyclesSampled).toBe(3); // 2 gaps only
    expect(s.regularity).toBe("unknown");
  });

  it("reports days since the last period START, not its end", () => {
    const s = computePeriodStats(block("2026-05-01", 5), "2026-05-10");
    expect(s.lastPeriodStart).toBe("2026-05-01");
    expect(s.daysSinceLastPeriodStart).toBe(9); // 05-01 → 05-10
    expect(s.daysSinceLastPeriod).toBe(5); // end 05-05 → 05-10 (end-based)
  });

  it("dedupes duplicate local_day rows", () => {
    const records: PeriodRecord[] = [
      { local_day: "2026-05-01", flow_level: "medium" },
      { local_day: "2026-05-01", flow_level: "heavy" },
      { local_day: "2026-05-02", flow_level: "medium" },
    ];
    const s = computePeriodStats(records, "2026-05-10");
    expect(s.cyclesSampled).toBe(1);
    expect(s.cycles[0].durationDays).toBe(2);
    expect(s.cycles[0].loggedFlowDays).toBe(2);
  });

  it("drops future-dated records", () => {
    const records = [...block("2026-06-01", 1)];
    const s = computePeriodStats(records, "2026-05-10");
    expect(s.cyclesSampled).toBe(0);
    expect(s.lastPeriodStart).toBeNull();
  });

  it("handles a leap-year month boundary in duration", () => {
    const records: PeriodRecord[] = [
      { local_day: "2024-02-28", flow_level: "medium" },
      { local_day: "2024-02-29", flow_level: "medium" },
      { local_day: "2024-03-01", flow_level: "medium" },
    ];
    const s = computePeriodStats(records, "2024-03-02");
    expect(s.cyclesSampled).toBe(1);
    expect(s.cycles[0].durationDays).toBe(3);
  });
});

describe("estimatePhase", () => {
  it("returns null for non-positive cycle days", () => {
    expect(estimatePhase(0, 5, 28)).toBeNull();
  });

  it("is menstrual within the period duration", () => {
    expect(estimatePhase(1, 5, 28)).toBe("menstrual");
    expect(estimatePhase(5, 5, 28)).toBe("menstrual");
  });

  it("is follicular after the period and before ovulation", () => {
    expect(estimatePhase(10, 5, 28)).toBe("follicular"); // ovulation ≈ day 14
  });

  it("is ovulation within ±1 of cycleLength − 14", () => {
    expect(estimatePhase(13, 5, 28)).toBe("ovulation");
    expect(estimatePhase(14, 5, 28)).toBe("ovulation");
    expect(estimatePhase(15, 5, 28)).toBe("ovulation");
  });

  it("is luteal after ovulation", () => {
    expect(estimatePhase(20, 5, 28)).toBe("luteal");
  });

  it("returns menstrual within duration but null past it when avg cycle is unknown", () => {
    expect(estimatePhase(3, 5, null)).toBe("menstrual");
    expect(estimatePhase(10, 5, null)).toBeNull();
  });
});
