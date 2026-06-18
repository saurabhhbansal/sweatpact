import { describe, it, expect } from "vitest";
import {
  isGymDone,
  isScheduleDone,
  isShortcutDone,
  isTourComplete,
} from "./completion";

describe("isGymDone", () => {
  it("is false when no gym is set", () => {
    expect(isGymDone(0)).toBe(false);
  });

  it("is true once at least one gym exists", () => {
    expect(isGymDone(1)).toBe(true);
    expect(isGymDone(3)).toBe(true);
  });
});

describe("isScheduleDone", () => {
  it("is false for a fresh profile with empty rest_days", () => {
    expect(isScheduleDone([])).toBe(false);
  });

  it("is true once rest_days is non-empty (the deliberate-edit signal)", () => {
    expect(isScheduleDone([0])).toBe(true);
    expect(isScheduleDone([0, 6])).toBe(true);
  });

  it("does not mutate the input array", () => {
    const input = Object.freeze([0, 6]) as number[];
    expect(() => isScheduleDone(input)).not.toThrow();
    expect(input).toEqual([0, 6]);
  });
});

describe("isShortcutDone", () => {
  it("is false when shortcut_viewed is absent", () => {
    expect(isShortcutDone([])).toBe(false);
    expect(isShortcutDone(["gym"])).toBe(false);
  });

  it("is true when shortcut_viewed is present", () => {
    expect(isShortcutDone(["shortcut_viewed"])).toBe(true);
    expect(isShortcutDone(["gym", "shortcut_viewed"])).toBe(true);
  });
});

describe("isTourComplete", () => {
  it("is false for an empty completed_steps", () => {
    expect(isTourComplete([])).toBe(false);
  });

  it("is false for the 3-of-4 partial case (missing shortcut_viewed)", () => {
    expect(isTourComplete(["gym", "challenge", "money"])).toBe(false);
  });

  it("is true when all four teaching keys are present", () => {
    expect(isTourComplete(["gym", "challenge", "money", "shortcut_viewed"])).toBe(true);
  });

  it("is true when all four keys are present plus non-gating extras", () => {
    expect(
      isTourComplete(["schedule", "gym", "challenge", "money", "shortcut_viewed"])
    ).toBe(true);
  });

  it("does not mutate the input array", () => {
    const input = Object.freeze(["gym", "challenge", "money", "shortcut_viewed"]) as string[];
    expect(() => isTourComplete(input)).not.toThrow();
    expect(input).toEqual(["gym", "challenge", "money", "shortcut_viewed"]);
  });
});
