---
phase: 08-event-instrumentation
reviewed: 2026-06-28T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/lib/analytics/server.ts
  - src/lib/analytics/server.test.ts
  - src/app/api/onboarding-progress/route.ts
  - src/app/api/checkin/route.ts
  - src/app/api/groups/create/route.ts
  - src/app/api/groups/join/route.ts
  - src/app/api/challenges/respond/route.ts
  - src/app/api/groups/leave/route.ts
  - src/lib/enforcement.ts
  - src/app/api/cron/enforce/route.ts
  - src/app/api/settlements/route.ts
  - src/components/nav.tsx
  - src/components/notifications-overlay.tsx
  - src/app/(tabs)/shortcut/client.tsx
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-06-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 08 adds PostHog server-side and client-side event instrumentation across 14 files. The `captureServerEvent` helper (`server.ts`) is well-designed — per-call client, immediate flush, swallowed errors, and a no-op guard when the key is absent. The client-side instrumentation in `nav.tsx`, `notifications-overlay.tsx`, and `shortcut/client.tsx` is lightweight and correct.

The critical defect is in the cron route: `posthog.shutdown()` sits in an unguarded `finally` block. When PostHog throws on shutdown (network error is the common case), the exception propagates and discards the already-built success response. Vercel Cron interprets this as a 500 and retries enforcement — a double-run risk for financial penalty operations.

Secondary concerns are a missing key-guard in the cron PostHog constructor, step-event deduplication gaps, two analytics blind spots (owner-leave, weekly penalties), and `distance_m` being emitted to a third-party analytics provider against the project's own PII constraint.

---

## Critical Issues

### CR-01: `posthog.shutdown()` in `finally` block can discard enforcement success and trigger a cron retry

**File:** `src/app/api/cron/enforce/route.ts:53-55`

**Issue:** `posthog.shutdown()` is awaited inside the `finally` block with no error guard. In JavaScript, an exception thrown from a `finally` block overrides any pending return value or `catch`-block result. If PostHog's shutdown HTTP call fails (network timeout, DNS failure), the enforcement result is discarded. Next.js surfaces an unhandled promise rejection; Vercel Cron sees a 500 and schedules a retry.

For a financial enforcement cron (issuing missed-day penalties and recording obligations), double-run is a correctness risk — users who were already penalized may be penalized again if the nightly re-run is not fully idempotent.

The `captureServerEvent` helper correctly swallows errors (`catch { /* Swallow */ }`). The cron route bypasses that helper and reimplements PostHog directly, omitting the same safety net.

**Fix:**
```typescript
} finally {
  try {
    await posthog.shutdown();
  } catch {
    // Analytics must never throw into business logic — swallow silently.
  }
}
```

---

## Warnings

### WR-01: Empty string passed to PostHog constructor when `NEXT_PUBLIC_POSTHOG_KEY` is absent

**File:** `src/app/api/cron/enforce/route.ts:29`

**Issue:** `process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ""` passes an empty string when the env var is not set. Unlike `captureServerEvent` (which guards with `if (!apiKey) return`), the cron route unconditionally constructs a PostHog client. With `flushAt: 1`, every `posthog.capture()` call in the penalized-user loop immediately triggers an outbound HTTP request to `eu.i.posthog.com` with an empty API key. In staging/CI environments that omit the key, this generates spurious network traffic and may cause `posthog.shutdown()` to throw (compounding CR-01).

**Fix:**
```typescript
const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Only construct if key is present — mirrors captureServerEvent guard.
const posthog = apiKey
  ? new PostHog(apiKey, { host: "https://eu.i.posthog.com", flushAt: 1, flushInterval: 0 })
  : null;

// ...in try block:
for (const userId of result.penalized_user_ids) {
  posthog?.capture({ distinctId: userId, event: EVENT.FINANCIAL_PENALTY_ISSUED });
}

// ...in finally block:
try { await posthog?.shutdown(); } catch { /* swallow */ }
```

### WR-02: `ONBOARDING_STEP_COMPLETED` fires on every PATCH replay, not only on first completion

**File:** `src/app/api/onboarding-progress/route.ts:93-97`

**Issue:** The step event fires whenever `parsed.data.complete_step` is truthy, regardless of whether the step was already in `existing.completed_steps`. `ONBOARDING_WALKTHROUGH_COMPLETED` has proper deduplication (`data.completed_at && !existing?.completed_at`), but the per-step event has no equivalent guard. A transient network failure causes the client to retry the same PATCH, emitting a second `onboarding:step_completed` event for the same step. This inflates step-completion counts in PostHog funnels without reflecting actual user behaviour.

**Fix:**
```typescript
// Guard: only fire if the step is not already in the existing set.
const stepAlreadyRecorded = (existing?.completed_steps ?? []).includes(
  parsed.data.complete_step
);
if (parsed.data.complete_step && !stepAlreadyRecorded) {
  await captureServerEvent(auth.user.id, EVENT.ONBOARDING_STEP_COMPLETED, {
    step_id: parsed.data.complete_step,
    tour_version: data.tour_version,
  });
}
```

### WR-03: Owner group dissolution emits no analytics event

**File:** `src/app/api/groups/leave/route.ts:39-54`

**Issue:** When an owner leaves a solo group (count ≤ 1), the route deletes both `group_members` and `groups` rows and returns at line 54 — before the `captureServerEvent` call at line 67. `PACT_MEMBER_LEFT` is only emitted for non-owner leavers. Group deletions via owner-leave are a complete analytics blind spot: no event, no property indicating that the group was dissolved. The `deleted_group: true` response field provides no PostHog signal.

**Fix:**
```typescript
if (membership.role === "owner") {
  // ...existing delete logic...
  await captureServerEvent(auth.user.id, EVENT.PACT_MEMBER_LEFT, {
    group_id: groupId,
    role: "owner",
    deleted_group: true,
  });
  return NextResponse.json({ ok: true, deleted_group: true });
}
```

### WR-04: `distance_m` (location-derived value) sent to PostHog against project PII constraint

**File:** `src/app/api/checkin/route.ts:144-148, 333-337`

**Issue:** The security constraint in `server.ts` (T-08-01-01) reads: "properties must contain only UUIDs and enum/constant values — never email, name, location coordinates, or any PII." `distance_m` is a floating-point scalar derived from the user's GPS coordinates relative to a known fixed point (their gym). It is not a raw coordinate, but it is location-derived personal data — repeated over time it reveals whether a user visited their gym and at what proximity, which qualifies as location data under GDPR Article 4(1).

Both `CHECKIN_GEO_FAILED` (line 144) and `CHECKIN_SUBMITTED` (line 333) emit this property on every check-in attempt to PostHog (a third-party processor). Bucket the value instead:

**Fix:**
```typescript
function distanceBucket(d: number | null): string {
  if (d === null) return "unknown";
  if (d <= 50) return "within_50m";
  if (d <= 200) return "within_200m";
  if (d <= 1000) return "within_1km";
  return "over_1km";
}

// Replace distance_m with the bucket:
await captureServerEvent(profile.id, EVENT.CHECKIN_GEO_FAILED, {
  method: body.source,
  distance_bucket: distanceBucket(distance),
});

await captureServerEvent(profile.id, EVENT.CHECKIN_SUBMITTED, {
  outcome: verified ? "verified" : "unverified",
  method: body.source,
  distance_bucket: distanceBucket(distance),
});
```

### WR-05: Weekly enforcement penalties are not instrumented

**File:** `src/lib/enforcement.ts:62-68` / `src/app/api/cron/enforce/route.ts:36-38`

**Issue:** `runEnforcement` populates `result.penalized_user_ids` only when a user's daily status transitions to `"missed"` (lines 54-58). The weekly enforcement path — `reconcileUserWeek` at line 64 — may independently compute and record financial obligations for users who missed their weekly goal, but its output is not captured in `result.penalized_user_ids`. The cron route emits `FINANCIAL_PENALTY_ISSUED` only for users in that array, meaning any penalty generated via the weekly path is invisible to the analytics pipeline.

**Fix:** Extend `EnforcementResult` with a `weekly_penalized_user_ids: string[]` field populated by `reconcileUserWeek` return value (if it produces one), and emit `FINANCIAL_PENALTY_ISSUED` for those users in the cron route alongside the daily set.

---

## Info

### IN-01: `posthog` missing from `useEffect` dependency array

**File:** `src/app/(tabs)/shortcut/client.tsx:595-598`

**Issue:** `posthog` is obtained from `usePostHog()` and used inside the effect but omitted from the dependency array. ESLint's `react-hooks/exhaustive-deps` rule will flag this. With React Strict Mode enabled (confirmed via `next.config.mjs`), the effect double-fires in development; the first invocation may see `posthog` as null if the PostHog provider hasn't resolved yet.

**Fix:**
```typescript
useEffect(() => {
  posthog?.capture(EVENT.FEATURE_SHORTCUT_SETUP_VIEWED);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // intentional: fire once on mount; posthog ref is stable after init
```
Add the suppression comment with an explanation, or pass `posthog` in the deps array (which fires again if PostHog re-initializes, which in practice never happens).

### IN-02: `CHECKIN_SUBMITTED` fires for `action="existing"` (no-op resubmissions)

**File:** `src/app/api/checkin/route.ts:333-337`

**Issue:** When `action = "existing"` (lines 247-249) — the user resubmits an unverified check-in when one already exists and they are still unverified — no database row is changed, but `CHECKIN_SUBMITTED` fires at line 333. Repeated taps on the check-in button inflate `checkin:submitted` event counts without genuine submissions. The notification skip at line 323 (`if (action !== "existing")`) already acknowledges this case for push notifications; analytics should apply the same gate.

**Fix:**
```typescript
// Only fire for genuine new or upgraded check-ins.
if (action !== "existing") {
  await captureServerEvent(profile.id, EVENT.CHECKIN_SUBMITTED, {
    outcome: verified ? "verified" : "unverified",
    method: body.source,
    distance_bucket: distanceBucket(distance), // see WR-04
  });
}
```

---

_Reviewed: 2026-06-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
