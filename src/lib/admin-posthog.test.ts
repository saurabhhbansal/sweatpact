import { describe, expect, it } from "vitest";

import { EVENT } from "@/lib/analytics/events";
import {
  checkinMethodQuery,
  dauWauQuery,
  geoFailByWeekQuery,
  notificationClickQuery,
  onboardingFunnelQuery,
  parseAdoptionRows,
  parseEngagementRows,
  parseFunnelRows,
  parseGeoFailRows,
  shortcutViewQuery,
  tabUsageQuery,
} from "@/lib/admin-posthog";

describe("HogQL query builders", () => {
  it("onboardingFunnelQuery groups step_completed by step_id", () => {
    const q = onboardingFunnelQuery();
    expect(q).toContain(`event = '${EVENT.ONBOARDING_STEP_COMPLETED}'`);
    expect(q).toContain("properties.step_id AS step");
    expect(q).toContain("count(DISTINCT person_id)");
    expect(q).toContain("GROUP BY step");
  });

  it("tabUsageQuery groups tab_visited by tab", () => {
    const q = tabUsageQuery();
    expect(q).toContain(`event = '${EVENT.FEATURE_TAB_VISITED}'`);
    expect(q).toContain("properties.tab AS tab");
    expect(q).toContain("GROUP BY tab");
  });

  it("checkinMethodQuery groups checkin_submitted by method", () => {
    const q = checkinMethodQuery();
    expect(q).toContain(`event = '${EVENT.CHECKIN_SUBMITTED}'`);
    expect(q).toContain("properties.method AS method");
    expect(q).toContain("GROUP BY method");
  });

  it("notificationClickQuery counts notification_clicked", () => {
    const q = notificationClickQuery();
    expect(q).toContain(`event = '${EVENT.FEATURE_NOTIFICATION_CLICKED}'`);
    expect(q).toContain("count() AS count");
  });

  it("shortcutViewQuery counts shortcut_setup_viewed", () => {
    const q = shortcutViewQuery();
    expect(q).toContain(`event = '${EVENT.FEATURE_SHORTCUT_SETUP_VIEWED}'`);
    expect(q).toContain("count() AS count");
  });

  it("geoFailByWeekQuery buckets geo_failed by ISO week over N days", () => {
    const q = geoFailByWeekQuery(30);
    expect(q).toContain(`event = '${EVENT.CHECKIN_GEO_FAILED}'`);
    expect(q).toContain("toStartOfWeek(timestamp) AS week");
    expect(q).toContain("INTERVAL 30 DAY");
    expect(q).toContain("GROUP BY week");
  });

  it("dauWauQuery returns daily distinct person_id over N days", () => {
    const q = dauWauQuery(7);
    expect(q).toContain("toDate(timestamp) AS day");
    expect(q).toContain("count(DISTINCT person_id)");
    expect(q).toContain("INTERVAL 7 DAY");
    expect(q).toContain("GROUP BY day");
  });

  it("day-count input is clamped to a non-negative integer literal", () => {
    // Defends against a non-integer / negative day count reaching the HogQL string.
    expect(geoFailByWeekQuery(-5)).toContain("INTERVAL 0 DAY");
    expect(dauWauQuery(30.9)).toContain("INTERVAL 30 DAY");
  });
});

describe("Zod response parsers", () => {
  describe("parseFunnelRows", () => {
    it("maps [step, users] tuples to typed rows", () => {
      expect(
        parseFunnelRows([
          ["welcome", 40],
          ["gym", 31],
        ])
      ).toEqual([
        { step: "welcome", users: 40 },
        { step: "gym", users: 31 },
      ]);
    });

    it("returns null for null input", () => {
      expect(parseFunnelRows(null)).toBeNull();
    });

    it("returns null on a shape mismatch", () => {
      expect(parseFunnelRows([["welcome", "not-a-number"]])).toBeNull();
    });
  });

  describe("parseAdoptionRows", () => {
    it("maps [label, count] tuples to typed rows", () => {
      expect(
        parseAdoptionRows([
          ["dashboard", 12],
          ["shortcut", 8],
        ])
      ).toEqual([
        { label: "dashboard", count: 12 },
        { label: "shortcut", count: 8 },
      ]);
    });

    it("returns null for null input", () => {
      expect(parseAdoptionRows(null)).toBeNull();
    });

    it("returns null on a shape mismatch", () => {
      expect(parseAdoptionRows([[123, 4]])).toBeNull();
    });
  });

  describe("parseEngagementRows", () => {
    it("maps [key, count] tuples to typed rows", () => {
      expect(
        parseEngagementRows([
          ["2026-06-27", 5],
          ["2026-06-28", 7],
        ])
      ).toEqual([
        { key: "2026-06-27", count: 5 },
        { key: "2026-06-28", count: 7 },
      ]);
    });

    it("returns null for null input", () => {
      expect(parseEngagementRows(null)).toBeNull();
    });

    it("returns null on a shape mismatch", () => {
      expect(parseEngagementRows([["2026-06-28", null]])).toBeNull();
    });
  });

  describe("parseGeoFailRows", () => {
    it("maps [week, count] tuples to typed rows", () => {
      expect(
        parseGeoFailRows([
          ["2026-06-22", 2],
          ["2026-06-29", 1],
        ])
      ).toEqual([
        { week: "2026-06-22", count: 2 },
        { week: "2026-06-29", count: 1 },
      ]);
    });

    it("returns null for null input", () => {
      expect(parseGeoFailRows(null)).toBeNull();
    });

    it("returns null on a shape mismatch", () => {
      expect(parseGeoFailRows([["2026-06-22"]])).toBeNull();
    });
  });
});
