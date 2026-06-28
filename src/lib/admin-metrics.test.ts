import { describe, it, expect } from "vitest";
import {
  settlementRate,
  activePactCount,
  totalStakesCents,
  usersWithActivePact,
  rangeToDays,
  rangeStartDay,
  bucketCheckinsByWeek,
  mergeGeoFailByWeek,
  computeAverageStreak,
  type WeekBucket,
} from "./admin-metrics";

describe("settlementRate", () => {
  it("returns 0 when settled + pending is 0 (no divide-by-zero)", () => {
    expect(settlementRate(0, 0)).toBe(0);
  });
  it("returns settled / (settled + pending)", () => {
    expect(settlementRate(3, 1)).toBe(0.75);
  });
  it("returns 1 when nothing is pending", () => {
    expect(settlementRate(2, 0)).toBe(1);
  });
});

describe("activePactCount", () => {
  it("counts only groups with >= 2 members", () => {
    expect(
      activePactCount([
        { group_id: "g1" },
        { group_id: "g1" },
        { group_id: "g2" },
      ])
    ).toBe(1);
  });
  it("returns 0 for an empty membership list", () => {
    expect(activePactCount([])).toBe(0);
  });
  it("counts multiple active pacts", () => {
    expect(
      activePactCount([
        { group_id: "g1" },
        { group_id: "g1" },
        { group_id: "g2" },
        { group_id: "g2" },
      ])
    ).toBe(2);
  });
});

describe("totalStakesCents", () => {
  it("sums default_penalty_cents across active groups", () => {
    expect(
      totalStakesCents([
        { default_penalty_cents: 5000 },
        { default_penalty_cents: 2500 },
      ])
    ).toBe(7500);
  });
  it("returns 0 for no active groups", () => {
    expect(totalStakesCents([])).toBe(0);
  });
});

describe("usersWithActivePact", () => {
  it("counts distinct user_ids in groups with >= 2 members", () => {
    expect(
      usersWithActivePact([
        { group_id: "g1", user_id: "u1" },
        { group_id: "g1", user_id: "u2" },
        { group_id: "g2", user_id: "u3" }, // single-member group excluded
      ])
    ).toBe(2);
  });
  it("returns 0 when there are no active pacts", () => {
    expect(usersWithActivePact([])).toBe(0);
  });
  it("does not double-count a user appearing once per active group", () => {
    expect(
      usersWithActivePact([
        { group_id: "g1", user_id: "u1" },
        { group_id: "g1", user_id: "u2" },
        { group_id: "g2", user_id: "u2" },
        { group_id: "g2", user_id: "u3" },
      ])
    ).toBe(3);
  });
});

describe("rangeToDays", () => {
  it("maps 7d -> 7", () => {
    expect(rangeToDays("7d")).toBe(7);
  });
  it("maps 30d -> 30", () => {
    expect(rangeToDays("30d")).toBe(30);
  });
  it("maps 90d -> 90", () => {
    expect(rangeToDays("90d")).toBe(90);
  });
  it("defaults unknown input to 30", () => {
    expect(rangeToDays("bogus")).toBe(30);
  });
});

describe("rangeStartDay", () => {
  it("returns an inclusive window start (days-1 back from today)", () => {
    // 7-day window inclusive of today => 6 days before today
    expect(rangeStartDay("2026-06-28", 7)).toBe("2026-06-22");
  });
  it("handles a 30-day window across a month boundary", () => {
    expect(rangeStartDay("2026-06-28", 30)).toBe("2026-05-30");
  });
  it("returns today itself for a 1-day window", () => {
    expect(rangeStartDay("2026-06-28", 1)).toBe("2026-06-28");
  });
});

describe("bucketCheckinsByWeek", () => {
  it("returns [] for no rows", () => {
    expect(bucketCheckinsByWeek([])).toEqual([]);
  });
  it("collapses two verified rows in the same ISO week into one bucket", () => {
    const out = bucketCheckinsByWeek([
      { local_day: "2026-06-22", status: "verified", source: "shortcut" },
      { local_day: "2026-06-24", status: "verified", source: "manual" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].verified).toBe(2);
    expect(out[0].total).toBe(2);
    expect(out[0].shortcut).toBe(1);
    expect(out[0].manual).toBe(1);
    expect(out[0].geoFail).toBe(0);
  });
  it("splits status and source counts", () => {
    const out = bucketCheckinsByWeek([
      { local_day: "2026-06-22", status: "verified", source: "shortcut" },
      { local_day: "2026-06-23", status: "unverified", source: "manual" },
    ]);
    expect(out[0].verified).toBe(1);
    expect(out[0].unverified).toBe(1);
    expect(out[0].shortcut).toBe(1);
    expect(out[0].manual).toBe(1);
    expect(out[0].total).toBe(2);
  });
  it("sorts buckets ascending by week", () => {
    const out = bucketCheckinsByWeek([
      { local_day: "2026-06-29", status: "verified", source: "shortcut" },
      { local_day: "2026-06-22", status: "verified", source: "shortcut" },
    ]);
    expect(out.map((b) => b.week)).toEqual(["2026-06-22", "2026-06-29"]);
  });
});

describe("mergeGeoFailByWeek", () => {
  it("sets geoFail on the matching week and leaves others at 0", () => {
    const buckets: WeekBucket[] = [
      {
        week: "2026-06-22",
        verified: 1,
        unverified: 0,
        manual: 0,
        shortcut: 1,
        geoFail: 0,
        total: 1,
      },
      {
        week: "2026-06-29",
        verified: 2,
        unverified: 0,
        manual: 0,
        shortcut: 2,
        geoFail: 0,
        total: 2,
      },
    ];
    const merged = mergeGeoFailByWeek(buckets, [
      { week: "2026-06-22", count: 3 },
    ]);
    expect(merged[0].geoFail).toBe(3);
    expect(merged[1].geoFail).toBe(0);
  });
  it("ignores geo-fail rows with no matching bucket", () => {
    const buckets: WeekBucket[] = [
      {
        week: "2026-06-22",
        verified: 1,
        unverified: 0,
        manual: 0,
        shortcut: 1,
        geoFail: 0,
        total: 1,
      },
    ];
    const merged = mergeGeoFailByWeek(buckets, [
      { week: "2099-01-01", count: 9 },
    ]);
    expect(merged[0].geoFail).toBe(0);
  });
});

describe("computeAverageStreak", () => {
  const today = "2026-06-28";

  it("returns 0 when there are no rows", () => {
    expect(computeAverageStreak([], today)).toBe(0);
  });

  it("counts consecutive days back from today for one user", () => {
    const rows = [
      { user_id: "u1", local_day: "2026-06-28" },
      { user_id: "u1", local_day: "2026-06-27" },
      { user_id: "u1", local_day: "2026-06-26" },
    ];
    expect(computeAverageStreak(rows, today)).toBe(3);
  });

  it("stops the streak at the first gap", () => {
    const rows = [
      { user_id: "u1", local_day: "2026-06-28" },
      { user_id: "u1", local_day: "2026-06-27" },
      // gap on 2026-06-26
      { user_id: "u1", local_day: "2026-06-25" },
    ];
    expect(computeAverageStreak(rows, today)).toBe(2);
  });

  it("gives a user with no row for today a streak of 0", () => {
    const rows = [
      { user_id: "u1", local_day: "2026-06-27" },
      { user_id: "u1", local_day: "2026-06-26" },
    ];
    expect(computeAverageStreak(rows, today)).toBe(0);
  });

  it("averages streaks across distinct users", () => {
    const rows = [
      // u1: streak 2 (28, 27)
      { user_id: "u1", local_day: "2026-06-28" },
      { user_id: "u1", local_day: "2026-06-27" },
      // u2: streak 1 (28 only)
      { user_id: "u2", local_day: "2026-06-28" },
    ];
    expect(computeAverageStreak(rows, today)).toBe(1.5);
  });

  it("does not double-count duplicate day rows for a user", () => {
    const rows = [
      { user_id: "u1", local_day: "2026-06-28" },
      { user_id: "u1", local_day: "2026-06-28" },
      { user_id: "u1", local_day: "2026-06-27" },
    ];
    expect(computeAverageStreak(rows, today)).toBe(2);
  });

  it("walks correctly across a month boundary", () => {
    const rows = [
      { user_id: "u1", local_day: "2026-07-01" },
      { user_id: "u1", local_day: "2026-06-30" },
      { user_id: "u1", local_day: "2026-06-29" },
    ];
    expect(computeAverageStreak(rows, "2026-07-01")).toBe(3);
  });
});
