import { describe, it, expect } from "vitest";
import {
  computeWeekStreak,
  deriveDayStatus,
  isoWeekMonday,
  proratedWeeklyGoal,
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

describe("proratedWeeklyGoal", () => {
  // ISO week: Mon 2026-06-08 … Sun 2026-06-14.
  const mon = "2026-06-08";

  it("returns the full goal when the user joined on or before the week's Monday", () => {
    expect(proratedWeeklyGoal(5, mon, "2026-06-01", [])).toBe(5); // joined earlier
    expect(proratedWeeklyGoal(5, mon, "2026-06-08", [])).toBe(5); // joined that Monday
  });

  it("returns 0 for a week entirely before the user joined", () => {
    expect(proratedWeeklyGoal(5, mon, "2026-06-15", [])).toBe(0);
  });

  it("prorates a mid-week join by round(goal * daysLeft / 7), min 1", () => {
    expect(proratedWeeklyGoal(5, mon, "2026-06-10", [])).toBe(4); // Wed, 5 days → 3.57→4
    expect(proratedWeeklyGoal(5, mon, "2026-06-12", [])).toBe(2); // Fri, 3 days → 2.14→2
    expect(proratedWeeklyGoal(5, mon, "2026-06-13", [])).toBe(1); // Sat, 2 days → 1.43→1
    expect(proratedWeeklyGoal(5, mon, "2026-06-14", [])).toBe(1); // Sun, 1 day → 0.71→min 1
  });

  it("caps the prorated goal at the achievable (non-rest) days remaining", () => {
    // Wed join (raw 4), but Sat(6) & Sun(0) are rest days → only Wed/Thu/Fri usable.
    expect(proratedWeeklyGoal(5, mon, "2026-06-10", [6, 0])).toBe(3);
  });

  it("returns 0 when every remaining day in the join week is a rest day", () => {
    // Fri join with Fri(5)/Sat(6)/Sun(0) all rest → nothing achievable → no debt.
    expect(proratedWeeklyGoal(5, mon, "2026-06-12", [5, 6, 0])).toBe(0);
  });
});

describe("computeWeekStreak — proration for the join week", () => {
  // Weeks (Mondays): W1 = 2026-05-25 (Sun 05-31), W2 = 2026-06-01. today in W2.
  const today = "2026-06-03";
  const statusMap = (days: Record<string, string>) => new Map(Object.entries(days));

  it("counts the first partial week when the prorated goal is met (would fail at full goal)", () => {
    const m = statusMap({
      // W1: joined Wed 05-27 → prorated goal round(5*5/7)=4; exactly 4 check-ins.
      "2026-05-27": "verified",
      "2026-05-28": "verified",
      "2026-05-29": "verified",
      "2026-05-31": "verified",
    });
    // With proration the partial week counts (streak 1); at the flat goal of 5 it wouldn't.
    expect(computeWeekStreak(m, today, 5, "2026-05-27", [])).toBe(1);
    expect(computeWeekStreak(m, today, 5)).toBe(0); // no joinDay → flat goal, week breaks
  });

  it("skips weeks entirely before the join without breaking the streak", () => {
    const m = statusMap({
      "2026-05-18": "missed", // W0 (before join) — forces the week into the map
      "2026-05-27": "verified",
      "2026-05-28": "verified",
      "2026-05-29": "verified",
      "2026-05-31": "verified",
    });
    expect(computeWeekStreak(m, today, 5, "2026-05-27", [])).toBe(1);
  });
});
