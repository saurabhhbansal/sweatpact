---
phase: 08-event-instrumentation
plan: "04"
subsystem: analytics
tags: [posthog, financial-events, enforcement-cron, settlements, typescript]
dependency_graph:
  requires: [src/lib/analytics/server.ts, src/lib/analytics/events.ts, posthog-node]
  provides: [EnforcementResult.penalized_user_ids, FINANCIAL_PENALTY_ISSUED events, FINANCIAL_SETTLEMENT_RECORDED event]
  affects: [src/lib/enforcement.ts, src/app/api/cron/enforce/route.ts, src/app/api/settlements/route.ts]
tech_stack:
  added: []
  patterns: [direct PostHog lifecycle management in cron (single client + shutdown in finally), captureServerEvent helper for settlements, penalized_user_ids accumulator on EnforcementResult]
key_files:
  created: []
  modified:
    - src/lib/enforcement.ts
    - src/app/api/cron/enforce/route.ts
    - src/app/api/settlements/route.ts
decisions:
  - "Cron route manages its own PostHog client lifecycle directly (not via captureServerEvent helper) — one client for N per-user captures + one shutdown in finally block ensures flush survives Vercel teardown"
  - "penalized_user_ids accumulated during the existing missed-transition check — same guard as result.penalized counter, no extra DB reads"
  - "FINANCIAL_PENALTY_ISSUED carries only user UUID as distinctId with no amount_cents — dollar amounts never reach PostHog properties (T-08-04-02)"
  - "FINANCIAL_SETTLEMENT_RECORDED placed after both DB writes succeed (after updateErr check) — event fires only on the happy path; early error returns prevent it from being reached"
  - "captureServerEvent uses named export in server.ts — plan said default export but named export is the implementation; fixed import accordingly"
metrics:
  duration: 12m
  completed: 2026-06-27
  tasks_completed: 2
  files_created: 0
  files_modified: 3
status: complete
requirements:
  - INSTR-04
---

# Phase 08 Plan 04: Financial Event Instrumentation Summary

## One-Liner

FINANCIAL_PENALTY_ISSUED and FINANCIAL_SETTLEMENT_RECORDED events wired to the enforcement cron and settlements route, with cron using direct PostHog lifecycle management (single client + finally-block shutdown) to survive Vercel function teardown.

## What Was Built

### `src/lib/enforcement.ts` — penalized_user_ids accumulator

Extended `EnforcementResult` type with a new `penalized_user_ids: string[]` field.

Key changes:
- `penalized_user_ids: string[]` added to the type definition
- `penalized_user_ids: []` added to the result initializer
- `result.penalized_user_ids.push(profile.id)` added inside the same `if (reconciled.status === "missed" && existing?.status !== "missed")` guard that increments `result.penalized` — identical precondition, no extra DB I/O

### `src/app/api/cron/enforce/route.ts` — PostHog lifecycle + FINANCIAL_PENALTY_ISSUED

Direct PostHog client management for the cron handler.

Key changes:
- Imports: `PostHog` from `posthog-node`, `EVENT` from `@/lib/analytics/events`
- `const posthog = new PostHog(...)` created after `createAdminClient()` and `new Date()`, before the try block — scoped to handle() lifetime
- PostHog config: `host: "https://eu.i.posthog.com"`, `flushAt: 1`, `flushInterval: 0`
- After `runEnforcement` returns: `for (const userId of result.penalized_user_ids) { posthog.capture({ distinctId: userId, event: EVENT.FINANCIAL_PENALTY_ISSUED }) }`
- `finally { await posthog.shutdown() }` — runs after both try and catch paths, guaranteeing flush before Vercel tears down the function
- No `captureServerEvent` import in the cron route — lifecycle is managed directly

### `src/app/api/settlements/route.ts` — FINANCIAL_SETTLEMENT_RECORDED

Standard helper-based instrumentation for the settlements POST handler.

Key changes:
- Imports: `{ captureServerEvent }` from `@/lib/analytics/server`, `EVENT` from `@/lib/analytics/events`
- `await captureServerEvent(auth.user.id, EVENT.FINANCIAL_SETTLEMENT_RECORDED, { obligation_id, group_id: oblig.group_id })` inserted after the `updateErr` if-block and immediately before the final `return NextResponse.json({ ok: true })`
- Event fires only when both the settlements insert (`settleErr`) and obligations status update (`updateErr`) succeed — all error paths return 500 before reaching this line

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Named export vs default export for captureServerEvent**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** Plan specified `import captureServerEvent from "@/lib/analytics/server"` (default import syntax), but `server.ts` uses a named export: `export async function captureServerEvent`. TypeScript error TS2613.
- **Fix:** Changed import to named syntax: `import { captureServerEvent } from "@/lib/analytics/server"`
- **Files modified:** `src/app/api/settlements/route.ts`
- **Commit:** 6f3232b

## Verification Results

- `npx tsc --noEmit` exits 0 — no TypeScript errors
- All 162 tests pass (13 test files) — vitest run clean
- `enforcement.ts` EnforcementResult type includes `penalized_user_ids: string[]`
- `enforcement.ts` result initializer includes `penalized_user_ids: []`
- `enforcement.ts` pushes `profile.id` in the missed-transition block
- `cron/enforce/route.ts` creates PostHog instance with `eu.i.posthog.com` host
- `cron/enforce/route.ts` emits FINANCIAL_PENALTY_ISSUED per user after `runEnforcement`
- `cron/enforce/route.ts` calls `await posthog.shutdown()` in a `finally` block
- `settlements/route.ts` emits FINANCIAL_SETTLEMENT_RECORDED with `obligation_id` and `group_id` before final return
- No dollar amounts in PostHog event properties (T-08-04-02 mitigated)

## Known Stubs

None — all three modifications are fully wired with real data sources.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond the plan's threat model. All threats from the plan's STRIDE register are mitigated:
- T-08-04-01: `await posthog.shutdown()` in `finally` block confirms Vercel-teardown protection
- T-08-04-02: Only UUIDs in event properties — no `amount_cents` fields
- T-08-04-03: `penalized_user_ids` populated only inside the same guard as `result.penalized`

## Self-Check

- [x] `enforcement.ts` type has `penalized_user_ids: string[]`
- [x] `enforcement.ts` push in missed-transition block
- [x] `cron/enforce/route.ts` has `posthog.shutdown()` in finally block
- [x] `settlements/route.ts` has `captureServerEvent` before final return
- [x] Commit 7274a0e (Task 1) exists in git log
- [x] Commit 6f3232b (Task 2) exists in git log
- [x] TypeScript strict mode satisfied
- [x] 162/162 tests pass

## Self-Check: PASSED
