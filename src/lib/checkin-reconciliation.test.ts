import { describe, it, expect } from "vitest";
import {
  deriveStatus,
  isClosedDay,
  splitCentsEvenly,
  type CheckinRow,
} from "./checkin-reconciliation";
import type { CheckinStatus } from "./types";

function row(status: CheckinStatus, id = status): CheckinRow {
  return {
    id,
    submission_id: `sub-${id}`,
    group_id: null,
    status,
    occurred_at: "2026-06-12T10:00:00Z",
  };
}

describe("deriveStatus precedence", () => {
  it("returns null when there are no active check-ins", () => {
    expect(deriveStatus([])).toBeNull();
    expect(deriveStatus([row("rejected")])).toBeNull();
  });

  it("verified beats everything", () => {
    const result = deriveStatus([
      row("unverified"),
      row("sick_day"),
      row("verified"),
      row("period_day"),
    ]);
    expect(result?.status).toBe("verified");
    expect(result?.checkinId).toBe("verified");
  });

  it("hard excuses beat unverified — a deliberate excuse is not silently overridden", () => {
    expect(deriveStatus([row("unverified"), row("sick_day")])?.status).toBe("sick_day");
    expect(deriveStatus([row("unverified"), row("rest_day")])?.status).toBe("rest_day");
    expect(deriveStatus([row("unverified"), row("gym_closed")])?.status).toBe("gym_closed");
  });

  it("unverified beats period_day — showing up wins over the automatic excuse", () => {
    expect(deriveStatus([row("period_day"), row("unverified")])?.status).toBe("unverified");
  });

  it("period_day wins only when it is the sole active record", () => {
    expect(deriveStatus([row("period_day")])?.status).toBe("period_day");
  });

  it("ignores rejected rows when picking the winner", () => {
    expect(deriveStatus([row("rejected"), row("unverified")])?.status).toBe("unverified");
  });
});

describe("splitCentsEvenly", () => {
  it("splits an even total equally", () => {
    expect(splitCentsEvenly(900, 3)).toEqual([300, 300, 300]);
  });

  it("distributes the remainder one cent at a time from the front", () => {
    expect(splitCentsEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitCentsEvenly(1001, 3)).toEqual([334, 334, 333]);
  });

  it("always sums back to the original total", () => {
    for (const [total, n] of [
      [999, 7],
      [1, 3],
      [50_000, 11],
    ] as const) {
      const parts = splitCentsEvenly(total, n);
      expect(parts).toHaveLength(n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("returns nothing for zero/negative totals or recipients", () => {
    expect(splitCentsEvenly(0, 3)).toEqual([]);
    expect(splitCentsEvenly(-100, 3)).toEqual([]);
    expect(splitCentsEvenly(100, 0)).toEqual([]);
  });
});

describe("isClosedDay", () => {
  // 2026-06-12T19:00:00Z is already 00:30 on Jun 13 in Asia/Kolkata.
  const now = new Date("2026-06-12T19:00:00Z");

  it("a day is closed once local midnight has passed", () => {
    expect(isClosedDay("2026-06-12", now, "Asia/Kolkata")).toBe(true);
    expect(isClosedDay("2026-06-12", now, "UTC")).toBe(false);
  });

  it("today and future days are open", () => {
    expect(isClosedDay("2026-06-13", now, "Asia/Kolkata")).toBe(false);
    expect(isClosedDay("2026-06-14", now, "Asia/Kolkata")).toBe(false);
  });
});
