import { describe, it, expect } from "vitest";
import {
  settlementRate,
  activePactCount,
  totalStakesCents,
  usersWithActivePact,
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
