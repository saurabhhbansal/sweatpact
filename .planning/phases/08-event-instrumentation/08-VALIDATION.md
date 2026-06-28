---
phase: 08
slug: event-instrumentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- src/lib/analytics/server.test.ts --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/lib/analytics/server.test.ts --reporter=verbose`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | INSTR-01 | T-08-01-01 | analytics key absent → no PostHog call | unit | `npm test -- src/lib/analytics/server.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | INSTR-01 | T-08-01-01 | error swallowed — no throw from PostHog failures | unit | `npm test -- src/lib/analytics/server.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | INSTR-01 | T-08-02-01 | event fires after DB success only | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-02-02 | 02 | 2 | INSTR-02 | T-08-02-01 | geo-fail event before 422 return | manual | `npm test` | ✅ | ⬜ pending |
| 08-03-01 | 03 | 2 | INSTR-03 | T-08-03-01 | pact events fire after both inserts | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-03-02 | 03 | 2 | INSTR-03 | T-08-03-02 | accept event after rollback guard | manual | `npm test` | ✅ | ⬜ pending |
| 08-04-01 | 04 | 2 | INSTR-04 | T-08-04-01 | shutdown in finally — flush before teardown | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-04-02 | 04 | 2 | INSTR-04 | T-08-04-02 | no amount_cents in event properties | manual | `npm test` | ✅ | ⬜ pending |
| 08-05-01 | 05 | 1 | INSTR-05 | T-08-05-01 | optional chaining prevents undefined.capture crash | manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 08-05-02 | 05 | 1 | INSTR-05 | T-08-05-01 | mount-only useEffect fires once | manual | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/analytics/server.test.ts` — unit tests for captureServerEvent (covers INSTR-01 helper behavior: capture args, shutdown, no-op when key absent, error swallow)

*Plan 08-01 Task 2 creates this file. No other Wave 0 gaps — all other tasks rely on manual TypeScript compilation and npm test suite checks per project convention (route.ts files are not unit-tested).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ONBOARDING_STEP_COMPLETED fires per step | INSTR-01 | Route handlers are not unit-tested per project convention | PATCH /api/onboarding-progress with complete_step; observe PostHog event in dashboard |
| ONBOARDING_WALKTHROUGH_COMPLETED fires only on first completion | INSTR-01 | Requires real DB state for transition detection | Complete tour twice; verify event appears once in PostHog |
| CHECKIN_GEO_FAILED fires on geo-reject | INSTR-02 | Requires real location/gym data | POST /api/checkin with location outside gym radius; verify PostHog event |
| CHECKIN_SUBMITTED fires with correct outcome | INSTR-02 | Requires real check-in flow | Submit verified and unverified check-ins; verify outcome property in PostHog |
| Pact lifecycle events fire at correct points | INSTR-03 | Requires real group creation and join flows | Create pact, accept/decline invitation, leave group; verify PostHog events |
| FINANCIAL_PENALTY_ISSUED per penalized user | INSTR-04 | Cron environment requires real enforcement run | Trigger cron enforce; verify per-user penalty events in PostHog |
| posthog.shutdown() prevents event loss | INSTR-04 | Requires Vercel function timing to test | Monitor PostHog for events after cron run completes |
| Tab visit events fire on click | INSTR-05 | Client-side click events require browser | Click nav tabs; verify FEATURE_TAB_VISITED in PostHog with tab property |
| Notification CTR fires on notification click | INSTR-05 | Browser interaction required | Open notifications overlay, click a notification; verify event in PostHog |
| Shortcut setup viewed fires on mount | INSTR-05 | Browser mount lifecycle required | Navigate to /shortcut; verify FEATURE_SHORTCUT_SETUP_VIEWED in PostHog |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
