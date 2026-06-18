import { describe, it, expect } from "vitest";
import { STEP_KEY_REGEX } from "../onboarding-progress";
import {
  TOUR_VERSION,
  STEPS,
  TEACHING_KEYS,
  type OnboardingStep,
} from "./steps";

describe("TOUR_VERSION", () => {
  it("is the number 1 (matches the Phase-1 tour_version default)", () => {
    expect(TOUR_VERSION).toBe(1);
  });
});

describe("STEPS registry", () => {
  it("lists the five step ids in exact order", () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      "schedule",
      "gym",
      "challenge",
      "money",
      "shortcut_viewed",
    ]);
  });

  it("every step id satisfies the Phase-1 STEP_KEY_REGEX", () => {
    for (const step of STEPS) {
      expect(STEP_KEY_REGEX.test(step.id)).toBe(true);
    }
  });

  it("attaches a surface to exactly schedule/gym/shortcut_viewed", () => {
    const withSurface = STEPS.filter((s) => s.surface !== undefined).map((s) => s.id);
    expect(withSurface.sort()).toEqual(["gym", "schedule", "shortcut_viewed"]);
  });

  it("leaves challenge and money with neither surface nor probe (presented-only, D-04)", () => {
    const presentedOnly = STEPS.filter((s) => s.id === "challenge" || s.id === "money");
    expect(presentedOnly).toHaveLength(2);
    for (const step of presentedOnly) {
      expect(step.surface).toBeUndefined();
      expect(step.probe).toBeUndefined();
    }
  });

  it("attaches a probe to exactly the three setup-bearing steps, each a valid ProbeId", () => {
    const withProbe = STEPS.filter((s) => s.probe !== undefined);
    expect(withProbe.map((s) => s.id).sort()).toEqual(["gym", "schedule", "shortcut_viewed"]);
    for (const step of withProbe) {
      expect(["gym", "schedule", "shortcut"]).toContain(step.probe);
    }
  });

  it("cannot be mutated by callers (registry is frozen)", () => {
    expect(Object.isFrozen(STEPS)).toBe(true);
    expect(() => {
      (STEPS as OnboardingStep[]).push({ id: "intruder", title: "x" });
    }).toThrow();
  });

  it("maps each step to its D-07 tab route", () => {
    const routeById = Object.fromEntries(STEPS.map((s) => [s.id, s.route]));
    expect(routeById).toEqual({
      schedule: "/dashboard",
      gym: "/dashboard",
      challenge: "/groups",
      money: "/groups",
      shortcut_viewed: "/shortcut",
    });
  });

  it("gives every step a non-empty route beginning with '/'", () => {
    for (const step of STEPS) {
      expect(typeof step.route).toBe("string");
      expect(step.route && step.route.length).toBeGreaterThan(0);
      expect(step.route?.startsWith("/")).toBe(true);
    }
  });

  it("does NOT bump TOUR_VERSION when adding the route field (still 1)", () => {
    expect(TOUR_VERSION).toBe(1);
  });
});

describe("TEACHING_KEYS", () => {
  it("equals the four completion-gating keys (schedule excluded)", () => {
    expect(TEACHING_KEYS).toEqual(["gym", "challenge", "money", "shortcut_viewed"]);
  });

  it("each teaching key corresponds to a step in STEPS (no orphan key)", () => {
    const ids = new Set(STEPS.map((s) => s.id));
    for (const key of TEACHING_KEYS) {
      expect(ids.has(key)).toBe(true);
    }
  });

  it("includes schedule in STEPS but NOT in TEACHING_KEYS (setup-bearing, not gating)", () => {
    expect(STEPS.some((s) => s.id === "schedule")).toBe(true);
    expect(TEACHING_KEYS).not.toContain("schedule");
  });
});
