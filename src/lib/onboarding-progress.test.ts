import { describe, it, expect } from "vitest";
import {
  PatchBody,
  STEP_KEY_REGEX,
  defaultProgress,
  mergeProgress,
  type ProgressRow,
} from "./onboarding-progress";

function blankRow(overrides: Partial<ProgressRow> = {}): ProgressRow {
  return { ...defaultProgress(), ...overrides };
}

describe("defaultProgress", () => {
  it("returns the documented missing-row default shape", () => {
    expect(defaultProgress()).toEqual({
      mandatory_done: false,
      tour_version: 1,
      last_step_id: null,
      completed_steps: [],
      dismissed: false,
      completed_at: null,
    });
  });

  it("returns a fresh array each call (no shared mutable state)", () => {
    const a = defaultProgress();
    a.completed_steps.push("gym");
    expect(defaultProgress().completed_steps).toEqual([]);
  });
});

describe("STEP_KEY_REGEX", () => {
  it("accepts lowercase snake/alphanumeric keys", () => {
    expect(STEP_KEY_REGEX.test("gym")).toBe(true);
    expect(STEP_KEY_REGEX.test("shortcut_viewed")).toBe(true);
    expect(STEP_KEY_REGEX.test("step_1")).toBe(true);
  });

  it("rejects uppercase, punctuation, empty, and over-long keys", () => {
    expect(STEP_KEY_REGEX.test("Gym")).toBe(false);
    expect(STEP_KEY_REGEX.test("Gym!")).toBe(false);
    expect(STEP_KEY_REGEX.test("")).toBe(false);
    expect(STEP_KEY_REGEX.test("a".repeat(41))).toBe(false);
  });
});

describe("PatchBody", () => {
  it("accepts a valid step key", () => {
    expect(PatchBody.safeParse({ complete_step: "shortcut_viewed" }).success).toBe(true);
    expect(PatchBody.safeParse({ complete_step: "gym" }).success).toBe(true);
  });

  it("rejects unknown fields (.strict())", () => {
    expect(PatchBody.safeParse({ foo: 1 }).success).toBe(false);
    expect(PatchBody.safeParse({ complete_step: "gym", extra: true }).success).toBe(false);
  });

  it("rejects malformed step keys", () => {
    expect(PatchBody.safeParse({ complete_step: "Gym!" }).success).toBe(false); // punctuation + uppercase
    expect(PatchBody.safeParse({ complete_step: "GYM" }).success).toBe(false); // uppercase
    expect(PatchBody.safeParse({ complete_step: "a".repeat(41) }).success).toBe(false); // too long
    expect(PatchBody.safeParse({ complete_step: "" }).success).toBe(false); // empty
  });

  it("accepts optional scalar fields", () => {
    expect(
      PatchBody.safeParse({
        last_step_id: "gym",
        mandatory_done: true,
        dismissed: true,
        completed_at: "2026-06-15T07:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("allows last_step_id to be null but not a malformed string", () => {
    expect(PatchBody.safeParse({ last_step_id: null }).success).toBe(true);
    expect(PatchBody.safeParse({ last_step_id: "Bad Key!" }).success).toBe(false);
  });

  it("allows completed_at to be null but rejects non-ISO strings", () => {
    expect(PatchBody.safeParse({ completed_at: null }).success).toBe(true);
    expect(PatchBody.safeParse({ completed_at: "not-a-date" }).success).toBe(false);
  });

  it("does NOT accept a client-sent full completed_steps array", () => {
    expect(PatchBody.safeParse({ completed_steps: ["gym", "money"] }).success).toBe(false);
  });
});

describe("mergeProgress", () => {
  it("appends a step to a blank row", () => {
    const merged = mergeProgress(blankRow(), { complete_step: "gym" });
    expect(merged.completed_steps).toEqual(["gym"]);
  });

  it("is idempotent — replaying the same complete_step is a no-op on the array", () => {
    const merged = mergeProgress(blankRow({ completed_steps: ["gym"] }), {
      complete_step: "gym",
    });
    expect(merged.completed_steps).toEqual(["gym"]);
  });

  it("twice-applied with the same key yields exactly one entry", () => {
    const once = mergeProgress(blankRow(), { complete_step: "gym" });
    const twice = mergeProgress(once, { complete_step: "gym" });
    expect(twice.completed_steps).toEqual(["gym"]);
  });

  it("appends additively, preserving order", () => {
    const merged = mergeProgress(blankRow({ completed_steps: ["gym"] }), {
      complete_step: "challenge",
    });
    expect(merged.completed_steps).toEqual(["gym", "challenge"]);
  });

  it("does not mutate the existing row's array", () => {
    const existing = blankRow({ completed_steps: ["gym"] });
    mergeProgress(existing, { complete_step: "money" });
    expect(existing.completed_steps).toEqual(["gym"]);
  });

  it("applies optional scalars when present", () => {
    const merged = mergeProgress(blankRow(), {
      last_step_id: "money",
      mandatory_done: true,
      dismissed: true,
      completed_at: "2026-06-15T07:00:00.000Z",
    });
    expect(merged.last_step_id).toBe("money");
    expect(merged.mandatory_done).toBe(true);
    expect(merged.dismissed).toBe(true);
    expect(merged.completed_at).toBe("2026-06-15T07:00:00.000Z");
  });

  it("leaves scalars unchanged when absent from the patch", () => {
    const existing = blankRow({
      last_step_id: "gym",
      mandatory_done: true,
      dismissed: false,
      completed_at: "2026-01-01T00:00:00.000Z",
    });
    const merged = mergeProgress(existing, { complete_step: "challenge" });
    expect(merged.last_step_id).toBe("gym");
    expect(merged.mandatory_done).toBe(true);
    expect(merged.dismissed).toBe(false);
    expect(merged.completed_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("applies null last_step_id / completed_at when explicitly passed", () => {
    const existing = blankRow({ last_step_id: "gym", completed_at: "2026-01-01T00:00:00.000Z" });
    const merged = mergeProgress(existing, { last_step_id: null, completed_at: null });
    expect(merged.last_step_id).toBeNull();
    expect(merged.completed_at).toBeNull();
  });

  it("preserves tour_version from the existing row", () => {
    const merged = mergeProgress(blankRow({ tour_version: 3 }), { complete_step: "gym" });
    expect(merged.tour_version).toBe(3);
  });
});
