---
phase: 08-event-instrumentation
plan: "02"
subsystem: analytics
tags: [posthog, server-side, analytics, typescript, onboarding, checkin]
dependency_graph:
  requires:
    - phase: 08-01
      provides: captureServerEvent helper in src/lib/analytics/server.ts
  provides:
    - ONBOARDING_STEP_COMPLETED emit in onboarding-progress PATCH (INSTR-01)
    - ONBOARDING_WALKTHROUGH_COMPLETED emit on null→set completed_at transition (INSTR-01)
    - CHECKIN_GEO_FAILED emit before 422 geo-reject return (INSTR-02)
    - CHECKIN_SUBMITTED emit before final 200 success return (INSTR-02)
  affects:
    - Phase 9 dashboard (consumes onboarding funnel and check-in outcome events)
tech_stack:
  added: []
  patterns:
    - "Post-DB-success placement: captureServerEvent always after error check, never on error paths"
    - "Geo-fail event fires inside the 422 conditional before the return"
    - "Walkthrough replay guard: gate on existing?.completed_at being falsy to prevent duplicate events"
key_files:
  created: []
  modified:
    - src/app/api/onboarding-progress/route.ts
    - src/app/api/checkin/route.ts
key_decisions:
  - "CHECKIN_SUBMITTED with outcome property used for both verified and unverified outcomes — keeps funnel analysis simple (one event type, one query)"
  - "ONBOARDING_WALKTHROUGH_COMPLETED gated on null→set transition of completed_at via existing?.completed_at — prevents replay duplicates"
  - "CHECKIN_GEO_FAILED fires before the 422 return inside the geo-reject conditional — profile.id is guaranteed non-null at that point"
patterns_established:
  - "Import pattern: { captureServerEvent } from @/lib/analytics/server; { EVENT } from @/lib/analytics/events"
  - "Placement rule: captureServerEvent after all DB error checks, before revalidateTag / final return"
requirements_completed:
  - INSTR-01
  - INSTR-02
duration: 8min
completed: 2026-06-27
status: complete
---

# Phase 08 Plan 02: API Route Instrumentation (INSTR-01, INSTR-02) Summary

**Two API routes instrumented with typed PostHog server-side events: onboarding step funnel tracking and check-in outcome capture, placed after DB success with replay and geo-fail guards.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-27T22:30:00Z
- **Completed:** 2026-06-27T22:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Onboarding-progress PATCH emits `ONBOARDING_STEP_COMPLETED` per completed step and `ONBOARDING_WALKTHROUGH_COMPLETED` on first-time completion (null→set transition guard prevents replay duplicates)
- Checkin POST emits `CHECKIN_GEO_FAILED` before the 422 geo-reject return and `CHECKIN_SUBMITTED` (with `outcome: "verified" | "unverified"`) before the final 200 return
- All 162 existing tests pass; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Instrument onboarding-progress PATCH (INSTR-01)** - `36af040` (feat)
2. **Task 2: Instrument checkin POST (INSTR-02)** - `e8ba603` (feat)

## Files Created/Modified

- `src/app/api/onboarding-progress/route.ts` - Added captureServerEvent calls for ONBOARDING_STEP_COMPLETED and ONBOARDING_WALKTHROUGH_COMPLETED after upsert success, before revalidateTag
- `src/app/api/checkin/route.ts` - Added captureServerEvent calls for CHECKIN_GEO_FAILED (geo-reject branch) and CHECKIN_SUBMITTED (success path)

## Decisions Made

- Used `CHECKIN_SUBMITTED` with `outcome` property for both verified and unverified check-ins (consistent with INSTR-02 plan and research recommendation A2) — `CHECKIN_VERIFIED` constant exists but is not emitted here; funnel query is simpler with one event + property filter
- `distance_m: distance` passed as-is (may be `null` when no gym coordinates are set) — `Record<string, unknown>` properties type accepts null, and the research confirmed this is acceptable (T-08-02-02)
- No additional try/catch at call sites — `captureServerEvent` already swallows internally

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — both analytics call sites are fully wired with real user IDs and event properties from Zod-validated request data.

## Threat Flags

No new network endpoints, auth paths, or schema changes. The two new PostHog write calls use data already validated by Zod at route entry and carry only UUIDs + enum values (no PII). All threat mitigations per the plan's threat register were applied:

- T-08-02-01 (Tampering: event before DB confirms): Mitigated — both calls placed after DB error checks confirm `error === null`
- T-08-02-02 (distance_m in geo-fail): Accepted — numeric distance, not a precise coordinate
- T-08-02-03 (walkthrough replay): Accepted and additionally mitigated — `existing?.completed_at` guard prevents duplicate events

## Self-Check

- [x] `src/app/api/onboarding-progress/route.ts` contains `captureServerEvent` for `ONBOARDING_STEP_COMPLETED` and `ONBOARDING_WALKTHROUGH_COMPLETED`
- [x] `src/app/api/checkin/route.ts` contains `captureServerEvent` for `CHECKIN_GEO_FAILED` and `CHECKIN_SUBMITTED`
- [x] Commits `36af040` and `e8ba603` exist in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `npm test` exits 0 (162/162 passing)

## Self-Check: PASSED

---
*Phase: 08-event-instrumentation*
*Completed: 2026-06-27*
