---
phase: quick-260701-ut9
plan: 01
subsystem: enforcement / reconciliation
status: complete
tags: [bugfix, cron, financial-correctness, idempotency]
requires:
  - src/lib/checkin-reconciliation.ts (reconcileUserWeek, weekMonday/isoWeekMonday, addDaysStr)
  - src/lib/time.ts (localDay)
provides:
  - reconcileMostRecentClosedWeek — daily self-healing weekly catch-up helper
affects:
  - src/lib/enforcement.ts (daily cron enforcement path)
tech-stack:
  added: []
  patterns:
    - Idempotent daily catch-up over a single-shot trigger for cron resilience
key-files:
  created: []
  modified:
    - src/lib/checkin-reconciliation.ts
    - src/lib/checkin-reconciliation.week.test.ts
    - src/lib/enforcement.ts
decisions:
  - Reuse the existing idempotent reconcileUserWeek instead of reimplementing penalty/reversal logic — daily invocation cannot double-charge and never reverses settled debt.
  - weeklyChecked metric semantics changed from "Sunday run happened" to "weekly catch-up attempted" (now increments every run).
metrics:
  duration: 4min
  completed: 2026-07-01
  tasks: 2
  files: 3
---

# Phase quick-260701-ut9 Plan 01: Weekly Penalty Catch-Up Summary

Weekly missed-goal penalties now update after any daily enforcement run following a closed ISO week — not just the single post-Sunday run — by reusing the idempotent `reconcileUserWeek` through a new `reconcileMostRecentClosedWeek` catch-up helper.

## What Was Built

**Root cause:** `runEnforcement` only ran the weekly goal check when the previous local day was a Sunday (`dayOfWeekFor(day) === 0`). That single-shot, non-recovering trigger meant a skipped, timed-out, or deploy-clobbered Sunday→Monday cron run left that week's penalties permanently uncreated — a user's owed amount silently failed to update after the week ended.

**Fix:**
- Added and exported `reconcileMostRecentClosedWeek(admin, { userId, today, now })` in `src/lib/checkin-reconciliation.ts`. It computes the most recently closed week's Sunday as one day before today's ISO-week Monday (`addDaysStr(weekMonday(today), -1)`) and delegates to the existing `reconcileUserWeek`. No penalty/obligation/reversal logic was reimplemented, so idempotency and the settled-debt safeguard are inherited.
- Rewired `runEnforcement` in `src/lib/enforcement.ts` to call `reconcileMostRecentClosedWeek` once per profile on every run, replacing the Sunday-only block. Removed the now-unused `dayOfWeekFor` helper and the direct `reconcileUserWeek` import; added `localDay` to the `@/lib/time` import.
- Added a `reconcileMostRecentClosedWeek` test block proving mid-week (Wednesday, `today = "2026-06-17"`) catch-up creates the prior week's `missed_weekly_goal` penalty for `2026-06-14`, splits obligations across peers, and stays idempotent on a second identical call.

**Behavior guarantees:** On a Monday run this is behavior-identical to the old Sunday trigger (last closed week's Sunday == yesterday). On every other day it re-reconciles the same last-closed week idempotently, healing a missed post-Sunday run. The still-in-progress current week is never penalized early (the helper steps strictly before today's ISO-week Monday).

## Tasks Completed

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| 1 | Add reconcileMostRecentClosedWeek helper + test (TDD) | 933fd7d (test), 555edaa (feat) | checkin-reconciliation.ts, checkin-reconciliation.week.test.ts |
| 2 | Rewire runEnforcement to run weekly catch-up daily | 6471194 (fix) | enforcement.ts |

## Verification

- `vitest run src/lib/checkin-reconciliation.week.test.ts` — 12/12 pass (RED confirmed before impl, GREEN after).
- `vitest run` — full suite 226/226 pass across 16 files.
- `tsc --noEmit` — exit 0, no type errors; no unused-symbol fallout from removing `dayOfWeekFor`.
- Code trace: Monday run reconciles weekEndDay == previous Sunday (identical to prior behavior); Tue–Sun runs re-reconcile the same last-closed week idempotently.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

- T-ut9-01 (Tampering / double-charge): mitigated — reuses the `(user_id, local_day, reason)` penalty upsert and `(penalty_event_id, to_user)` obligation upsert with `ignoreDuplicates`; the new idempotency test proves a second daily run does not double the debt.
- T-ut9-02 (Repudiation / settled-debt reversal): accepted and unchanged — `reconcileUserWeek` still refuses to reverse once any obligation is settled; existing "does NOT reverse … once settled" test still passes.
- T-ut9-SC (supply chain): no new dependencies installed.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/lib/checkin-reconciliation.ts (reconcileMostRecentClosedWeek exported)
- FOUND: src/lib/checkin-reconciliation.week.test.ts (catch-up test block)
- FOUND: src/lib/enforcement.ts (reconcileMostRecentClosedWeek call, dayOfWeekFor removed)
- FOUND commit: 933fd7d (test)
- FOUND commit: 555edaa (feat)
- FOUND commit: 6471194 (fix)
