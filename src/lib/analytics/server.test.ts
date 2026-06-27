import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Track calls across test assertions via module-level vi.fn() references.
// These are declared with vi.hoisted so they are available when vi.mock factory runs.
const { mockCapture, mockShutdown } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockShutdown: vi.fn().mockResolvedValue(undefined),
}));

// vi.mock is hoisted before all imports. Vitest 4.x requires the mock
// implementation to use 'function' or 'class' syntax when mocking constructors.
vi.mock("posthog-node", () => {
  function PostHog(this: Record<string, unknown>) {
    this.capture = mockCapture;
    this.shutdown = mockShutdown;
  }
  return { PostHog: vi.fn().mockImplementation(PostHog) };
});

import { PostHog } from "posthog-node";
import { captureServerEvent } from "@/lib/analytics/server";
import { EVENT } from "@/lib/analytics/events";

const MockPostHog = vi.mocked(PostHog);

describe("captureServerEvent", () => {
  const savedKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  beforeEach(() => {
    mockCapture.mockReset();
    mockShutdown.mockReset().mockResolvedValue(undefined);
    MockPostHog.mockClear();
  });

  afterEach(() => {
    // Restore env var to its pre-suite state.
    if (savedKey !== undefined) {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = savedKey;
    } else {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    }
  });

  it("calls posthog.capture with the correct distinctId, event, and properties when key is set", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";

    await captureServerEvent("user-123", EVENT.ONBOARDING_STEP_COMPLETED, {
      step_id: "gym",
      tour_version: 2,
    });

    expect(MockPostHog).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({ host: "https://eu.i.posthog.com" })
    );
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-123",
        event: EVENT.ONBOARDING_STEP_COMPLETED,
        properties: { step_id: "gym", tour_version: 2 },
      })
    );
  });

  it("calls posthog.shutdown() after capture when the key is set", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";

    await captureServerEvent("user-456", EVENT.CHECKIN_SUBMITTED, {
      outcome: "verified",
      method: "manual",
    });

    expect(mockCapture).toHaveBeenCalledOnce();
    expect(mockShutdown).toHaveBeenCalledOnce();
  });

  it("does not call posthog.capture when NEXT_PUBLIC_POSTHOG_KEY is not set", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    await captureServerEvent("user-789", EVENT.PACT_CREATED);

    expect(MockPostHog).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("does not throw when the PostHog client throws internally", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    mockCapture.mockImplementationOnce(() => {
      throw new Error("PostHog internal error");
    });

    // Should resolve without throwing — error is swallowed silently.
    await expect(
      captureServerEvent("user-err", EVENT.FINANCIAL_PENALTY_ISSUED)
    ).resolves.toBeUndefined();
  });
});
