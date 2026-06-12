import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  localDay,
  normalizeTimeZone,
  previousLocalDay,
} from "./time";

describe("normalizeTimeZone", () => {
  it("keeps valid IANA zones", () => {
    expect(normalizeTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(normalizeTimeZone("America/New_York")).toBe("America/New_York");
    expect(normalizeTimeZone("UTC")).toBe("UTC");
  });

  it("falls back to the default for invalid, empty, or missing zones", () => {
    expect(normalizeTimeZone("Not/AZone")).toBe(DEFAULT_TIME_ZONE);
    expect(normalizeTimeZone("")).toBe(DEFAULT_TIME_ZONE);
    expect(normalizeTimeZone("   ")).toBe(DEFAULT_TIME_ZONE);
    expect(normalizeTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
    expect(normalizeTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects junk", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("localDay", () => {
  it("projects the same instant into different local days across zones", () => {
    // 20:00 UTC on Jan 1 is already Jan 2 in Kolkata (UTC+5:30)? No — 20:00+5:30 = 01:30 Jan 2.
    const at = new Date("2026-01-01T20:00:00Z");
    expect(localDay(at, "UTC")).toBe("2026-01-01");
    expect(localDay(at, "Asia/Kolkata")).toBe("2026-01-02");
    expect(localDay(at, "America/New_York")).toBe("2026-01-01");
  });

  it("handles the midnight boundary in the user's zone", () => {
    // 18:29 UTC = 23:59 IST (same day); 18:31 UTC = 00:01 IST (next day)
    expect(localDay(new Date("2026-03-10T18:29:00Z"), "Asia/Kolkata")).toBe("2026-03-10");
    expect(localDay(new Date("2026-03-10T18:31:00Z"), "Asia/Kolkata")).toBe("2026-03-11");
  });
});

describe("previousLocalDay", () => {
  it("returns the calendar day before today in the user's zone", () => {
    // 01:00 IST on Jun 12 → yesterday is Jun 11
    const at = new Date("2026-06-11T19:30:00Z"); // 01:00 IST Jun 12
    expect(localDay(at, "Asia/Kolkata")).toBe("2026-06-12");
    expect(previousLocalDay(at, "Asia/Kolkata")).toBe("2026-06-11");
  });

  it("crosses month and year boundaries", () => {
    const at = new Date("2026-01-01T12:00:00Z");
    expect(previousLocalDay(at, "UTC")).toBe("2025-12-31");
  });
});
