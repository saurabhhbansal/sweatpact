---
phase: 08-event-instrumentation
plan: "01"
subsystem: analytics
tags: [posthog, server-side, analytics, typescript, testing]
dependency_graph:
  requires: [src/lib/analytics/events.ts, posthog-node]
  provides: [src/lib/analytics/server.ts, src/lib/analytics/server.test.ts]
  affects: [src/app/api/onboarding-progress/route.ts, src/app/api/checkin/route.ts, src/app/api/groups/create/route.ts, src/app/api/groups/leave/route.ts, src/app/api/challenges/respond/route.ts, src/app/api/settlements/route.ts, src/app/api/cron/enforce/route.ts]
tech_stack:
  added: []
  patterns: [per-call PostHog instantiation, silent try-catch for analytics isolation, vi.hoisted + function-syntax constructor mocking]
key_files:
  created: [src/lib/analytics/server.ts, src/lib/analytics/server.test.ts]
  modified: []
decisions:
  - "Per-call PostHog instantiation used (not module-level singleton) — stateless, safe for serverless, no cold-start leak"
  - "EU endpoint hardcoded as https://eu.i.posthog.com — NEXT_PUBLIC_POSTHOG_HOST is /ingest (browser reverse proxy), invalid for server-to-server"
  - "await client.shutdown() called inside helper — with flushAt:1+flushInterval:0 ensures synchronous delivery before function returns"
  - "Vitest 4.x requires function/class syntax in constructor mock implementations — used vi.hoisted() + function-syntax PostHog mock"
metrics:
  duration: 10m
  completed: 2026-06-27
  tasks_completed: 2
  files_created: 2
status: complete
---

# Phase 08 Plan 01: Server-Side PostHog Helper Summary

## One-Liner

Per-call `captureServerEvent()` helper using posthog-node with EU endpoint, silent error swallowing, and immediate flush via flushAt:1 + shutdown().

## What Was Built

### `src/lib/analytics/server.ts`

New module providing the shared server-side PostHog event capture helper. All subsequent server-route instrumentation plans (08-02 through 08-04) import this function.

Key implementation details:
- `import { PostHog } from "posthog-node"` — named export, v5 API
- New `PostHog` instance created per `captureServerEvent()` call — no module-level state
- EU direct ingestion endpoint: `https://eu.i.posthog.com` (confirmed from `next.config.mjs` rewrites)
- `flushAt: 1, flushInterval: 0` — forces immediate single-event delivery, no batching delay in serverless
- `client.capture(...)` then `await client.shutdown()` — synchronous flush before function returns
- Outer `try/catch` with empty catch — analytics failures are swallowed; business logic is never interrupted
- Early return no-op when `NEXT_PUBLIC_POSTHOG_KEY` is falsy — covers CI/test environments

JSDoc security annotation: properties must contain only UUIDs and enum/constant values, never PII (mitigates T-08-01-01).

### `src/lib/analytics/server.test.ts`

Unit tests using Vitest with posthog-node mocked via `vi.mock`. Four test cases covering all plan-required behaviors:

1. Constructor called with correct API key + EU host; `capture()` called with correct distinctId, event, properties
2. `shutdown()` called after `capture()` — flush guaranteed
3. No-op when `NEXT_PUBLIC_POSTHOG_KEY` is unset — PostHog constructor not invoked
4. Errors from PostHog internals are swallowed — function resolves without throwing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest 4.x constructor mock requires function/class syntax**
- **Found during:** Task 2 (test execution)
- **Issue:** Initial `vi.fn().mockImplementation(() => ({ ... }))` approach silently ignored the implementation for `new` constructor calls in Vitest 4.x — the mock was registered and called, but the returned object (with `capture`/`shutdown` vi.fn()s) was not used as the instance. Vitest 4.x emits a warning: "The vi.fn() mock did not use 'function' or 'class' in its implementation."
- **Fix:** Rewrote the mock factory to use `function` keyword syntax with `this.capture = mockCapture` and module-level vi.fn()s via `vi.hoisted()`. This satisfies Vitest 4.x's requirement for constructor mocks.
- **Files modified:** `src/lib/analytics/server.test.ts`
- **Commit:** 1902f6f

## Verification Results

- `npx tsc --noEmit` exits 0 — no TypeScript errors
- All 4 tests pass in `server.test.ts`
- All 6 existing tests in `events.test.ts` still pass (10 total)
- `server.ts` contains `"eu.i.posthog.com"` (confirmed EU region)
- No module-level PostHog instance in `server.ts`

## Known Stubs

None — implementation is complete and non-stubbed.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond the plan's threat model.

## Self-Check

- [x] `src/lib/analytics/server.ts` exists and exports `captureServerEvent`
- [x] `src/lib/analytics/server.test.ts` exists with 4 passing tests
- [x] Commits 92361f9 and 1902f6f exist in git log
- [x] TypeScript strict mode satisfied

## Self-Check: PASSED
