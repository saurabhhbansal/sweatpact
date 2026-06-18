import { describe, it, expect } from "vitest";
import { STEPS } from "@/lib/onboarding/steps";
import { deriveDotStates, type DotState } from "@/lib/onboarding/coachmark-progress";

describe("deriveDotStates", () => {
  it("returns one entry per STEPS step, in STEPS order, length === STEPS.length", () => {
    const dots = deriveDotStates("challenge");
    expect(dots).toHaveLength(STEPS.length);
    expect(dots.map((d) => d.id)).toEqual(STEPS.map((s) => s.id));
  });

  it("splits past/current/future around a mid step (challenge, index 2)", () => {
    const states = deriveDotStates("challenge").map((d) => d.state);
    expect(states).toEqual<DotState[]>([
      "past",
      "past",
      "current",
      "future",
      "future",
    ]);
  });

  it("marks the first step current with all others future, none past", () => {
    const states = deriveDotStates("schedule").map((d) => d.state);
    expect(states).toEqual<DotState[]>([
      "current",
      "future",
      "future",
      "future",
      "future",
    ]);
    expect(states).not.toContain("past");
  });

  it("marks the last step current with all prior past, none future", () => {
    const states = deriveDotStates("shortcut_viewed").map((d) => d.state);
    expect(states).toEqual<DotState[]>([
      "past",
      "past",
      "past",
      "past",
      "current",
    ]);
    expect(states).not.toContain("future");
  });

  it("treats null as no current step — every dot future", () => {
    const dots = deriveDotStates(null);
    expect(dots).toHaveLength(STEPS.length);
    expect(dots.every((d) => d.state === "future")).toBe(true);
  });

  it("treats an unknown step id as no current step — every dot future, no throw", () => {
    expect(() => deriveDotStates("not_a_step")).not.toThrow();
    const dots = deriveDotStates("not_a_step");
    expect(dots).toHaveLength(STEPS.length);
    expect(dots.every((d) => d.state === "future")).toBe(true);
  });

  it("carries the step id on each entry so the renderer can key on it", () => {
    for (const dot of deriveDotStates("money")) {
      expect(typeof dot.id).toBe("string");
      expect(STEPS.some((s) => s.id === dot.id)).toBe(true);
    }
  });
});
