import { describe, it, expect } from "vitest";
import {
  computeWeekStreak,
  deriveDayStatus,
  isoWeekMonday,
  shouldCountTowardStreak,
} from "./derived-status";

describe("isoWeekMonday", () => {
  it("maps every weekday to that week's Monday", () => {
    // 2026-06-08 is a Monday
    expect(isoWeekMonday("2026-06-08")).toBe("2026-06-08"); // Mon
    expect(isoWeekMonday("2026-06-10")).toBe("2026-06-08"); // Wed
    expect(isoWeekMonday("2026-06-13")).toBe("2026-06-08"); // Sat
  });

  it("keeps Sunday in the week that started the previous Monday", () => {
    // 2026-06-14 is a Sunday → belongs to the week of Mon 2026-06-08
    expect(isoWeekMonday("2026-06-14")).toBe("2026-06-08");
  });

  it("crosses month and year boundaries", () => {
    // 2026-01-01 is a Thursday → Monday is 2025-12-29
    expect(isoWeekMonday("2026-01-01")).toBe("2025-12-29");
  });
});

describe("shouldCountTowardStreak", () => {
  it("counts only actual gym days", () => {
    expect(shouldCountTowardStreak("verified")).toBe(true);
    expect(shouldCountTowardStreak("unverified")).toBe(true);
    expect(shouldCountTowardStreak("rest_day")).toBe(false);
    expect(shouldCountTowardStreak("sick_day")).toBe(false);
    expect(shouldCountTowardStreak("missed")).toBe(false);
    expect(shouldCountTowardStreak("pending")).toBe(false);
  });
});

describe("deriveDayStatus", () => {
  const today = "2026-06-12";

  it("recorded status always wins", () => {
    expect(
      deriveDayStatus({ recorded: "verified", day: "2026-06-01", today, isRestDay: true })
    ).toBe("verified");
    expect(
      deriveDayStatus({ recorded: "missed", day: "2026-06-01", today, isRestDay: false })
    ).toBe("missed");
  });

  it("future days are future, even on rest days", () => {
    expect(
      deriveDayStatus({ recorded: undefined, day: "2026-06-13", today, isRestDay: false })
    ).toBe("future");
    expect(
      deriveDayStatus({ recorded: undefined, day: "2026-06-13", today, isRestDay: true })
    ).toBe("future");
  });

  it("rest days without a record show rest_day", () => {
    expect(
      deriveDayStatus({ recorded: undefined, day: "2026-06-10", today, isRestDay: true })
    ).toBe("rest_day");
  });

  it("a past non-rest day with no record is derived as missed", () => {
    expect(
      deriveDayStatus({ recorded: undefined, day: "2026-06-11", today, isRestDay: false })
    ).toBe("missed");
  });

  it("today with no record stays pending — still time to check in", () => {
    expect(
      deriveDayStatus({ recorded: undefined, day: today, today, isRestDay: false })
    ).toBe("pending");
  });
});

describe("computeWeekStreak", () => {
  // Week layout used below (Mondays): W1 = 2026-05-25, W2 = 2026-06-01, W3 = 2026-06-08.
  // "today" = Fri 2026-06-12 (inside W3).
  const today = "2026-06-12";

  function statusMap(days: Record<string, string>) {
    return new Map(Object.entries(days));
  }

  it("counts consecutive completed weeks plus a current week that already hit goal", () => {
    const m = statusMap({
      // W1: 2 check-ins
      "2026-05-25": "verified",
      "2026-05-27": "unverified",
      // W2: 2 check-ins
      "2026-06-02": "verified",
      "2026-06-04": "verified",
      // W3 (current): 2 check-ins → already met goal
      "2026-06-08": "verified",
      "2026-06-10": "verified",
    });
    expect(computeWeekStreak(m, today, 2)).toBe(3);
  });

  it("a current in-progress week below goal neither counts nor breaks", () => {
    const m = statusMap({
      "2026-05-25": "verified",
      "2026-05-27": "verified",
      "2026-06-02": "verified",
      "2026-06-04": "verified",
      // W3 (current): only 1 of 2 so far
      "2026-06-08": "verified",
    });
    expect(computeWeekStreak(m, today, 2)).toBe(2);
  });

  it("a past week below goal ends the streak", () => {
    const m = statusMap({
      // W1: met goal — but unreachable past the broken W2
      "2026-05-25": "verified",
      "2026-05-27": "verified",
      // W2: only 1 of 2 → breaks
      "2026-06-02": "verified",
      // W3 (current): met goal
      "2026-06-08": "verified",
      "2026-06-10": "verified",
    });
    expect(computeWeekStreak(m, today, 2)).toBe(1);
  });

  it("rest and excused days do not count toward the goal", () => {
    const m = statusMap({
      "2026-06-08": "verified",
      "2026-06-09": "rest_day",
      "2026-06-10": "sick_day",
    });
    expect(computeWeekStreak(m, today, 2)).toBe(0);
  });

  it("a Sunday check-in lands in the same ISO week as the preceding Monday", () => {
    const m = statusMap({
      "2026-06-08": "verified", // Mon W3
      "2026-06-14": "verified", // Sun W3
    });
    // today moved to the Sunday — week complete at goal 2
    expect(computeWeekStreak(m, "2026-06-14", 2)).toBe(1);
  });

  it("empty history is a zero streak", () => {
    expect(computeWeekStreak(new Map(), today, 4)).toBe(0);
  });
});
