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
  });

  it("treats a single logged day as a one-day cycle with no prediction", () => {
    const s = computePeriodStats(block("2026-05-01", 1), "2026-05-01");
    expect(s.cyclesSampled).toBe(1);
    expect(s.cycles[0].durationDays).toBe(1);
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
    });
    expect(s.averageDurationDays).toBe(5);
  });

  it("starts a new cycle when a day is skipped (gap > 1)", () => {
    // 05-01, 05-03 — the missing 05-02 splits these into two cycles.
    const records: PeriodRecord[] = [
      { local_day: "2026-05-01", flow_level: "medium" },
      { local_day: "2026-05-03", flow_level: "medium" },
    ];
    const s = computePeriodStats(records, "2026-05-03");
    expect(s.cyclesSampled).toBe(2);
  });

  it("computes average cycle length and predicts the next start", () => {
    const records = [...block("2026-04-01", 5), ...block("2026-04-29", 5)];
    const s = computePeriodStats(records, "2026-05-10");
    expect(s.cyclesSampled).toBe(2);
    expect(s.averageCycleDays).toBe(28); // 04-01 → 04-29
    expect(s.nextPredictedStart).toBe("2026-05-27"); // 04-29 + 28
    expect(s.daysUntilPredicted).toBe(17); // 05-10 → 05-27
  });

  it("uses a negative daysUntilPredicted when overdue", () => {
    const records = [...block("2026-04-01", 1), ...block("2026-04-29", 1)];
    const s = computePeriodStats(records, "2026-06-01");
    expect(s.nextPredictedStart).toBe("2026-05-27");
    expect(s.daysUntilPredicted).toBe(-5); // predicted in the past
  });

  it("labels tight cycle lengths as regular", () => {
    // Cycle starts: 01-01, +27 → 01-28, +29 → 02-26. gaps [27, 29], spread 2.
    const records = [
      ...block("2026-01-01", 1),
      ...block("2026-01-28", 1),
      ...block("2026-02-26", 1),
    ];
    const s = computePeriodStats(records, "2026-03-01");
    expect(s.cyclesSampled).toBe(3);
    expect(s.cycleLengthSpreadDays).toBe(2);
    expect(s.regularity).toBe("regular");
    expect(s.averageCycleDays).toBe(28);
  });

  it("labels widely varying cycle lengths as irregular", () => {
    // gaps [24, 35], spread 11.
    const records = [
      ...block("2026-01-01", 1),
      ...block("2026-01-25", 1),
      ...block("2026-03-01", 1),
    ];
    const s = computePeriodStats(records, "2026-03-10");
    expect(s.cyclesSampled).toBe(3);
    expect(s.cycleLengthSpreadDays).toBe(11);
    expect(s.regularity).toBe("irregular");
  });

  it("keeps regularity unknown with fewer than 3 cycles", () => {
    const records = [...block("2026-04-01", 1), ...block("2026-04-29", 1)];
    const s = computePeriodStats(records, "2026-05-01");
    expect(s.cyclesSampled).toBe(2);
    expect(s.cycleLengthSpreadDays).toBeNull();
    expect(s.regularity).toBe("unknown");
  });

  it("handles a leap-year month boundary in duration", () => {
    // 2024 is a leap year: 02-28, 02-29, 03-01 are consecutive.
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

  it("falls back to follicular when average cycle is unknown", () => {
    expect(estimatePhase(10, 5, null)).toBe("follicular");
  });
});
