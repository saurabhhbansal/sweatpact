---
phase: 07-analytics-foundation
plan: "01"
subsystem: analytics
tags: [posthog, event-catalog, typescript, tdd]
requires: []
provides:
  - EVENT const object (14 typed event name constants)
  - EventName TypeScript union type
affects:
  - Phase 8 instrumentation call sites (import EVENT from @/lib/analytics/events)
tech_stack:
  added:
    - posthog-js ^1.395.0
    - posthog-node ^5.38.6
  patterns:
    - as const object for typed event catalog
    - category:object_action naming convention for PostHog event names
key_files:
  created:
    - src/lib/analytics/events.ts
    - src/lib/analytics/events.test.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - PostHog SDKs added to runtime dependencies (not devDependencies) — both needed at runtime (posthog-js for client, posthog-node for server routes and cron)
  - engines.node set to "20.x" in package.json (not vercel.json functions.runtime) — current Vercel mechanism per FOUND-05; satisfies posthog-node@5 peer requirement >=20.20.0
  - EVENT object uses as const for full literal-type narrowing, enabling EventName as a union of all string literals
metrics:
  duration: "3min"
  completed: "2026-06-27"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
status: complete
requirements_satisfied:
  - FOUND-03
  - FOUND-05
---

# Phase 07 Plan 01: PostHog SDK Installation and Event Catalog Summary

**One-liner:** PostHog JS/Node SDKs installed with Node 20.x engine constraint; 14-constant typed event catalog with format-validation tests.

## What Was Built

### Task 1 — Install PostHog SDKs and Node.js engine constraint (FOUND-05)

- Ran `npm install posthog-js posthog-node` adding both to runtime dependencies
- Added `"engines": { "node": "20.x" }` to `package.json` at root level
- This satisfies `posthog-node@5` peer requirement (`^20.20.0 || >=22.22.0`) on Vercel

**Versions installed:** posthog-js ^1.395.0, posthog-node ^5.38.6

### Task 2 — Typed event catalog with TDD (FOUND-03)

**RED:** Created `src/lib/analytics/events.test.ts` with 6 tests covering format regex, uniqueness, spot-checks, and entry count. Tests failed as expected (module not found).

**GREEN:** Created `src/lib/analytics/events.ts` exporting:
- `EVENT` — `as const` object with 14 event name constants following `category:object_action` convention
- `EventName` — TypeScript union type `(typeof EVENT)[keyof typeof EVENT]`

All 6 tests pass, `npx tsc --noEmit` exits 0.

## Event Catalog

| Key | Value |
|-----|-------|
| ONBOARDING_STEP_COMPLETED | onboarding:step_completed |
| ONBOARDING_WALKTHROUGH_COMPLETED | onboarding:walkthrough_completed |
| CHECKIN_SUBMITTED | checkin:submitted |
| CHECKIN_VERIFIED | checkin:verified |
| CHECKIN_GEO_FAILED | checkin:geo_failed |
| PACT_CREATED | pact:created |
| PACT_INVITE_ACCEPTED | pact:invite_accepted |
| PACT_INVITE_DECLINED | pact:invite_declined |
| PACT_MEMBER_LEFT | pact:member_left |
| FINANCIAL_PENALTY_ISSUED | financial:penalty_issued |
| FINANCIAL_SETTLEMENT_RECORDED | financial:settlement_recorded |
| FEATURE_TAB_VISITED | feature:tab_visited |
| FEATURE_NOTIFICATION_CLICKED | feature:notification_clicked |
| FEATURE_SHORTCUT_SETUP_VIEWED | feature:shortcut_setup_viewed |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4537ed9 | chore | install posthog-js posthog-node and add engines.node 20.x |
| 304bf1b | test | add failing tests for event catalog format validation (RED) |
| 9e6e82b | feat | create typed event catalog with 14 PostHog event constants (GREEN) |

## Verification Results

1. `node -e "require('./package.json').engines"` → `{ node: '20.x' }` PASS
2. `node -e "const p=require('./package.json'); console.log(p.dependencies['posthog-js'], p.dependencies['posthog-node'])"` → `^1.395.0 ^5.38.6` PASS
3. `npm test -- src/lib/analytics/events.test.ts` → 6/6 tests passed PASS
4. `npx tsc --noEmit` → exit 0 PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates a pure constants module with no UI rendering or data dependencies.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The `as const` event catalog is a type-only module with no runtime side effects.

## TDD Gate Compliance

- RED gate: commit `304bf1b` — `test(07-01)` commit with failing tests
- GREEN gate: commit `9e6e82b` — `feat(07-01)` commit with passing implementation

## Self-Check: PASSED

- [x] src/lib/analytics/events.ts exists
- [x] src/lib/analytics/events.test.ts exists
- [x] package.json has engines.node = "20.x"
- [x] package.json has posthog-js and posthog-node in dependencies
- [x] Commits 4537ed9, 304bf1b, 9e6e82b all exist in git log
