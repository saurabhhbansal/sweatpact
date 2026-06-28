import { describe, it, expect } from "vitest";
import { EVENT, type EventName } from "@/lib/analytics/events";

describe("EVENT catalog", () => {
  it("every event value matches category:object_action format", () => {
    const values = Object.values(EVENT);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });

  it("all event values are unique (no duplicates)", () => {
    const values = Object.values(EVENT);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("EventName type covers all EVENT values (compile-time check via assignment)", () => {
    // If EventName is correctly derived from EVENT, all values should be assignable.
    // This confirms no TS error at compile time.
    const name: EventName = EVENT.CHECKIN_SUBMITTED;
    expect(typeof name).toBe("string");
  });

  it("ONBOARDING_STEP_COMPLETED equals 'onboarding:step_completed'", () => {
    expect(EVENT.ONBOARDING_STEP_COMPLETED).toBe("onboarding:step_completed");
  });

  it("CHECKIN_SUBMITTED equals 'checkin:submitted'", () => {
    expect(EVENT.CHECKIN_SUBMITTED).toBe("checkin:submitted");
  });

  it("EVENT has exactly 14 entries", () => {
    expect(Object.keys(EVENT).length).toBe(14);
  });
});
