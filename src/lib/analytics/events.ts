/**
 * Typed event catalog for PostHog analytics.
 *
 * Naming convention: category:object_action — lowercase, underscores between words.
 * All call sites import EVENT from this file; no inline event-name strings allowed.
 */
export const EVENT = {
  ONBOARDING_STEP_COMPLETED: "onboarding:step_completed",
  ONBOARDING_WALKTHROUGH_COMPLETED: "onboarding:walkthrough_completed",
  CHECKIN_SUBMITTED: "checkin:submitted",
  CHECKIN_VERIFIED: "checkin:verified",
  CHECKIN_GEO_FAILED: "checkin:geo_failed",
  PACT_CREATED: "pact:created",
  PACT_INVITE_ACCEPTED: "pact:invite_accepted",
  PACT_INVITE_DECLINED: "pact:invite_declined",
  PACT_MEMBER_LEFT: "pact:member_left",
  FINANCIAL_PENALTY_ISSUED: "financial:penalty_issued",
  FINANCIAL_SETTLEMENT_RECORDED: "financial:settlement_recorded",
  FEATURE_TAB_VISITED: "feature:tab_visited",
  FEATURE_NOTIFICATION_CLICKED: "feature:notification_clicked",
  FEATURE_SHORTCUT_SETUP_VIEWED: "feature:shortcut_setup_viewed",
} as const;

/** Union of all event name string literals — use this for typed PostHog capture calls. */
export type EventName = (typeof EVENT)[keyof typeof EVENT];
