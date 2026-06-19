import { describe, expect, it } from "vitest";
import { PACT_LIVE_SEEN_KEY, shouldShowPactLive } from "./pact-live";

describe("PACT_LIVE_SEEN_KEY", () => {
  it("is the cosmetic seen-flag key 'pact_live_seen'", () => {
    expect(PACT_LIVE_SEEN_KEY).toBe("pact_live_seen");
  });

  it("satisfies STEP_KEY_REGEX so the existing PATCH endpoint accepts it", () => {
    expect(/^[a-z0-9_]{1,40}$/.test(PACT_LIVE_SEEN_KEY)).toBe(true);
  });
});

describe("shouldShowPactLive", () => {
  it("shows when mounted, has an active challenge, and not yet seen", () => {
    expect(
      shouldShowPactLive({
        mounted: true,
        hasActiveChallenge: true,
        completedSteps: [],
      })
    ).toBe(true);
  });

  it("is suppressed before client mount (portal guard)", () => {
    expect(
      shouldShowPactLive({
        mounted: false,
        hasActiveChallenge: true,
        completedSteps: [],
      })
    ).toBe(false);
  });

  it("is suppressed when the viewer has no active challenge (D-01 trigger)", () => {
    expect(
      shouldShowPactLive({
        mounted: true,
        hasActiveChallenge: false,
        completedSteps: [],
      })
    ).toBe(false);
  });

  it("is suppressed once pact_live_seen is persisted (shown exactly once, D-03)", () => {
    expect(
      shouldShowPactLive({
        mounted: true,
        hasActiveChallenge: true,
        completedSteps: ["schedule", "gym", PACT_LIVE_SEEN_KEY],
      })
    ).toBe(false);
  });

  it("ignores other completed steps that are not the seen-flag", () => {
    expect(
      shouldShowPactLive({
        mounted: true,
        hasActiveChallenge: true,
        completedSteps: ["schedule", "gym", "challenge", "money"],
      })
    ).toBe(true);
  });
});
