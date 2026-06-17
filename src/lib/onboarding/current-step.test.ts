import { describe, it, expect } from "vitest";
import { deriveCurrentStep } from "./current-step";

// Neutral probe: no gym, no schedule, no shortcut — auto-skip never fires.
const neutralProbe = { gymCount: 0, restDays: [] as number[], completedSteps: [] as string[] };

describe("deriveCurrentStep — dismissed short-circuits (D-10 / ONB-04)", () => {
  it("returns null immediately when dismissed=true, regardless of completed_steps", () => {
    expect(
      deriveCurrentStep(["gym", "challenge", "money", "shortcut_viewed"], true, neutralProbe)
    ).toBeNull();
  });

  it("returns null even on a completely empty slate when dismissed=true", () => {
    expect(deriveCurrentStep([], true, neutralProbe)).toBeNull();
  });
});

describe("deriveCurrentStep — fresh slate returns first step", () => {
  it("returns 'schedule' (first in STEPS registry) when nothing is completed", () => {
    expect(deriveCurrentStep([], false, neutralProbe)).toBe("schedule");
  });
});

describe("deriveCurrentStep — resume from partial completed_steps", () => {
  it("returns 'challenge' when schedule and gym are already completed", () => {
    expect(deriveCurrentStep(["schedule", "gym"], false, neutralProbe)).toBe("challenge");
  });

  it("returns 'money' when schedule, gym, and challenge are completed", () => {
    expect(deriveCurrentStep(["schedule", "gym", "challenge"], false, neutralProbe)).toBe("money");
  });

  it("returns 'shortcut_viewed' when all except shortcut are completed", () => {
    expect(
      deriveCurrentStep(["schedule", "gym", "challenge", "money"], false, neutralProbe)
    ).toBe("shortcut_viewed");
  });
});

describe("deriveCurrentStep — tour complete returns null", () => {
  it("returns null when all four teaching keys + schedule are present", () => {
    expect(
      deriveCurrentStep(
        ["schedule", "gym", "challenge", "money", "shortcut_viewed"],
        false,
        neutralProbe
      )
    ).toBeNull();
  });

  it("returns 'schedule' when only the four teaching keys are present (schedule still pending)", () => {
    // schedule is NOT a teaching key and is not auto-skippable with neutral probe — it is pending.
    // This confirms schedule is setup-bearing and requires explicit completion or a non-empty restDays probe.
    expect(
      deriveCurrentStep(["gym", "challenge", "money", "shortcut_viewed"], false, neutralProbe)
    ).toBe("schedule");
  });
});

describe("deriveCurrentStep — auto-skip via probe (D-09)", () => {
  it("skips 'gym' step when gymCount > 0 (isGymDone)", () => {
    const gymDoneProbe = { gymCount: 1, restDays: [] as number[], completedSteps: [] as string[] };
    // With completedSteps=[], schedule is first and not auto-skippable → returned.
    expect(deriveCurrentStep([], false, gymDoneProbe)).toBe("schedule");
  });

  it("skips 'gym' and returns next pending step when schedule is also completed", () => {
    const gymDoneProbe = { gymCount: 2, restDays: [] as number[], completedSteps: [] as string[] };
    // schedule done in completed_steps, gym auto-skipped → 'challenge' is next
    expect(deriveCurrentStep(["schedule"], false, gymDoneProbe)).toBe("challenge");
  });

  it("skips 'schedule' step when restDays is non-empty (isScheduleDone)", () => {
    const scheduleDoneProbe = {
      gymCount: 0,
      restDays: [0, 6] as number[],
      completedSteps: [] as string[],
    };
    // schedule auto-skipped → 'gym' is next (not yet completed, gymCount=0)
    expect(deriveCurrentStep([], false, scheduleDoneProbe)).toBe("gym");
  });

  it("skips 'shortcut_viewed' step when shortcut_viewed is in probe.completedSteps", () => {
    const shortcutDoneProbe = {
      gymCount: 0,
      restDays: [] as number[],
      completedSteps: ["shortcut_viewed"],
    };
    // All other steps completed in progress row; shortcut_viewed auto-skipped → null (complete)
    expect(
      deriveCurrentStep(["schedule", "gym", "challenge", "money"], false, shortcutDoneProbe)
    ).toBeNull();
  });
});

describe("deriveCurrentStep — inputs are not mutated", () => {
  it("does not mutate completedSteps", () => {
    const steps = Object.freeze(["schedule", "gym"]) as string[];
    expect(() => deriveCurrentStep(steps, false, neutralProbe)).not.toThrow();
    expect(steps).toEqual(["schedule", "gym"]);
  });

  it("does not mutate probe arrays", () => {
    const probe = {
      gymCount: 0,
      restDays: Object.freeze([0]) as unknown as number[],
      completedSteps: Object.freeze(["shortcut_viewed"]) as unknown as string[],
    };
    expect(() => deriveCurrentStep([], false, probe)).not.toThrow();
  });
});
