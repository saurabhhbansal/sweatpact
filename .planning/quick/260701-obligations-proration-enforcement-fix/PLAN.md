---
title: Obligations proration + weekly enforcement repair
status: awaiting-approval
created: 2026-07-01
author: audit (opus)
kind: quick-plan
---

# Weekly Obligations: Proration + Enforcement Repair — PLAN

## Why this exists

An audit of the obligations/enforcement path (triggered by "penalties not updating
after end of week") surfaced three real problems and one test gap:

1. **CRITICAL — weekly penalty writes have been silently throwing since ~2026-06-08.**
   `ensurePenaltyForGroup` upserts with `onConflict: "user_id,local_day,reason"`, but
   migration `0004_checkin_reconciliation.sql` dropped that 3-column constraint and
   replaced it with a 4-column **expression** index
   `(user_id, local_day, reason, COALESCE(group_id, zero))`. PostgREST cannot target an
   expression index by bare column list, so the insert fails with Postgres
   `42P10: there is no unique or exclusion constraint matching the ON CONFLICT
   specification` (confirmed by direct, non-mutating probe against production).
   `runEnforcement` catches per-user and only increments an error counter → the failure
   is invisible. Result: zero weekly penalties created for the weeks ending 06-14, 06-21,
   06-28. The earlier quick-fix (removing the Sunday-only gate) did **not** address this —
   every catch-up call still throws here.

2. **HIGH — no join-date awareness → unfair penalties on partial first weeks.**
   `reconcileUserWeek` counts check-ins across the full ISO week (Mon–Sun) and compares to
   the flat per-user `weekly_goal`, ignoring `group_members.joined_at`. A user who joins
   Friday with a 5-day goal can never hit 5 in a 3-day window → guaranteed penalty.

3. **MED — settlements route hardening gaps** (`src/app/api/settlements/route.ts`):
   a voided/disputed obligation can still be settled; the client-supplied `amount_cents`
   is used unclamped; the settle check→update is not atomic (double-settle race).

4. **Test gap** — the weekly reconciliation tests mock Supabase, so the `onConflict`
   string is never validated against a real index. That is why #1 shipped green.

Data already remediated during the audit (see "Data state" below); this plan is the
**code + schema** repair plus the requested proration model.

## Locked decisions

- Partial first week is **prorated**, not skipped.
- Proration rounding: **`Math.round`, minimum 1**, additionally **capped to the number of
  achievable (non-rest) days** remaining in the week so the goal is never impossible.
- Delivery: this written plan first → sign-off → implement on a branch → diff review.
- Retroactive setting edits: **leave as-is.** Enforcement reads the *current*
  `weekly_goal` / `rest_days` and applies them to past weeks (pre-existing behavior;
  proration inherits it). No per-week goal snapshot in this plan.
- Corrected re-backfill of the legit gaps the broken `onConflict` never created is a
  **separate follow-up** with its own approval, run through the fixed prorated logic.

## Proration model (single source of truth)

New pure function in `src/lib/derived-status.ts` (already the shared home of
`isoWeekMonday`, imported by enforcement and by the UI):

```ts
// Effective weekly goal for a given ISO week, accounting for a mid-week join.
// - joinDay <= weekMonday        → full goal (member all week)
// - joinDay >  weekSunday        → 0  (not a member that week; caller skips)
// - otherwise (join week)        → round(goal * availableDays / 7), min 1,
//                                   capped at achievable (non-rest) days in-window
export function proratedWeeklyGoal(
  weeklyGoal: number,
  weekMonday: string,      // YYYY-MM-DD (ISO week Monday)
  joinDay: string,         // YYYY-MM-DD (membership joined_at, local date)
  restDays: number[]       // 0=Sun..6=Sat
): number {
  const weekSunday = addDaysStr(weekMonday, 6);
  if (joinDay <= weekMonday) return weeklyGoal;
  if (joinDay > weekSunday) return 0;

  const availableDays = daysBetweenInclusive(joinDay, weekSunday); // 1..6
  const eligibleDays = countNonRestDays(joinDay, weekSunday, restDays);
  if (eligibleDays === 0) return 0; // every remaining day is a rest day → nothing to owe

  const raw = Math.round((weeklyGoal * availableDays) / 7);
  return Math.min(weeklyGoal, eligibleDays, Math.max(1, raw));
}
```

Worked examples (goal = 5, no rest days):

| Join day (local) | Days left (join→Sun) | round(5·d/7) | Effective goal |
|------------------|----------------------|--------------|----------------|
| Monday           | 7 (full week)        | —            | 5              |
| Wednesday        | 5                    | 4 (3.57)     | 4              |
| Friday           | 3                    | 2 (2.14)     | 2              |
| Saturday         | 2                    | 1 (1.43)     | 1              |
| Sunday           | 1                    | 1 (0.71→1)   | 1              |

Rest-day cap example (goal 5, joined Friday, Saturday is a rest day): available = 3
(Fri,Sat,Sun) but eligible = 2 (Fri,Sun) → effective goal = min(5, 2, round(2.14)=2) = 2,
achievable.

## Task breakdown

### Task 1 — Restore weekly enforcement (CRITICAL)
**Files:** new `supabase/migrations/0033_penalty_conflict_target.sql`,
`src/lib/checkin-reconciliation.ts`

- Migration: add a plain (non-expression) unique index PostgREST can infer.
  `group_id` is always non-null on this insert path, so it enforces the same uniqueness:
  ```sql
  create unique index if not exists penalty_events_user_day_reason_group_key
    on public.penalty_events (user_id, local_day, reason, group_id);
  ```
  Keep the existing expression index (harmless; still guards any null-group rows).
- Code: `ensurePenaltyForGroup` upsert →
  `onConflict: "user_id,local_day,reason,group_id"` (line ~163).
- Leave the obligations upsert `onConflict: "penalty_event_id,to_user"` unchanged — it
  matches the real unique constraint from `0027`.

**Verify:** apply migration to a scratch/local DB; run the same `42P10` probe with the new
conflict target and confirm it resolves; `rtk vitest run`; `rtk tsc`.

### Task 2 — Proration in the money path
**Files:** `src/lib/derived-status.ts`, `src/lib/checkin-reconciliation.ts`

- Add `proratedWeeklyGoal` (+ the small date helpers `daysBetweenInclusive`,
  `countNonRestDays`) to `derived-status.ts`; export.
- `reconcileUserWeek`:
  - Extend the profile select to include `rest_days`.
  - Per membership: `joinDay = membership.joined_at?.slice(0,10)`;
    `effGoal = proratedWeeklyGoal(weeklyGoal, weekStartDay, joinDay ?? weekStartDay, restDays)`.
  - If `effGoal === 0` → reverse any stale unsettled penalty via
    `clearWeeklyPenaltyForGroup` and `continue` (pre-join / all-rest week; no debt).
  - Count check-ins over `[max(weekStartDay, joinDay), weekEndDay]` (align numerator with
    the prorated denominator) instead of the whole week.
  - `goalMet = checkinDays >= effGoal`; reversal path uses the same `effGoal`.
- `reconcileMostRecentClosedWeek` / `reconcileWeekForDayIfClosed` need no change — they
  delegate to `reconcileUserWeek`, so proration is centralized.

**Verify:** proration unit tests (Task 5); `rtk tsc`.

### Task 3 — Streak + display consistency
**Files:** `src/lib/derived-status.ts` (`computeWeekStreak`), `src/lib/stats.ts`,
`src/app/(tabs)/dashboard/page.tsx`, `src/components/progress-section.tsx`

- `computeWeekStreak(statusByDay, today, weeklyGoal, joinDay?, restDays?)`: for each walked
  ISO week use `proratedWeeklyGoal(...)` when `joinDay` is provided; a `0` result is a
  non-breaking skip (week before join). This keeps a user's own first partial week from
  unfairly breaking the streak (uses profile-level join = `profile.created_at`, the correct
  anchor for the global per-user streak).
- Pass `joinDay` + `restDays` from `computeProfileStats` (`stats.ts`) and from
  `dashboard/page.tsx` (`joinedDay` already derived there).
- Display: when the current week is the join week, show the prorated goal in the
  `X / goal` badge (dashboard + `progress-section`) via the same function. Update the
  dashboard streak copy so "A week counts when you hit your N-day goal. Partial weeks don't
  break the streak." reflects prorated first weeks (e.g. "…partial first weeks use a
  prorated goal").

**Verify:** streak unit tests (Task 5); manual dashboard smoke via `rtk next build` or dev.

### Task 4 — Settlements route hardening
**File:** `src/app/api/settlements/route.ts`

- Reject unless `oblig.status === "pending"` (blocks settling voided/disputed/already-
  settled) — return `409 { error: "not_settleable", status }`.
- Drop the client `amount_cents` override; always settle `oblig.amount_cents` (partial
  settlement isn't modeled). Keep `note`.
- Make the state transition atomic: `.update({ status: "settled" }).eq("id", id)
  .eq("status", "pending").select("id")`; if no row returned, another request won — roll
  back the settlement row and return `409`.

**Verify:** unit/route tests for each guard (Task 5); `rtk tsc`.

### Task 5 — Tests (close the gap that hid Task 1)
**Files:** `src/lib/derived-status.test.ts`, `src/lib/checkin-reconciliation.week.test.ts`,
new `src/lib/proration.test.ts` (or colocated), settlements route test

- `proratedWeeklyGoal` pure unit tests: full week, Wed/Fri/Sat/Sun joins, rest-day cap,
  all-rest→0, pre-join→0. (No mock — real coverage.)
- `computeWeekStreak` proration: partial join week counts when prorated goal met; doesn't
  break streak when unmet; pre-join week skipped.
- **onConflict guard test:** assert the conflict target strings used in
  `checkin-reconciliation.ts` correspond to a unique index declared in
  `supabase/migrations/*.sql` (parse the SQL). This mechanically prevents a repeat of
  Task 1's class of bug that the mocked DB can't catch.
- Settlements: voided/disputed rejected; amount override ignored; concurrent double-settle
  yields exactly one settlement.

## Rollout order

1. Task 1 migration + code (restores enforcement) — deploy-blocking.
2. Task 2 + Task 3 (proration + display).
3. Task 4 (settlements).
4. Task 5 tests land with their respective tasks (TDD where practical: Task 1 conflict
   test, Task 2 proration tests first).
5. Deploy; confirm the next cron run creates weekly penalties (non-zero) and logs 0 errors.
6. **Follow-up (separate approval):** corrected re-backfill of legit missing weeks using
   the prorated logic; exact target list presented before any write.

## Data state (already remediated during audit — informational)

- Root-cause outage confirmed via production probe (`42P10`).
- The earlier emergency backfill created 34 `missed_weekly_goal` penalties; 25 were wrong
  under the join-date/proration rules (23 pre-join + 2 mid-week) and have been **deleted**
  along with their obligations (guarded: 0 settled). 9 legitimate full-member-week
  penalties remain and are correct at the flat goal (they are not join weeks).
- No obligation was ever settled during this work; all writes were reversible.

## Risks / notes

- **Retroactive edits:** changing `weekly_goal`/`rest_days` still re-scores past weeks on
  the next reconcile (unchanged by this plan). Called out so it's a conscious choice, not a
  surprise.
- **Multi-group:** proration is per-membership (`joined_at` per group); the global streak
  uses `profile.created_at`. These can differ for a user in multiple groups — acceptable:
  money is per-group and exact; the streak is a per-user display heuristic.
- **Migration safety:** the new unique index builds cleanly only if no duplicate
  `(user_id, local_day, reason, group_id)` rows exist. Verify with a pre-check query before
  applying (expected: none, since the expression index already enforces this for non-null
  group_id).
- **`daily_status` is per-user, not per-group:** the check-in count for a join week counts
  the user's check-ins in the window regardless of which group they were for. With the
  `[max(weekStart, joinDay), weekEnd]` window this is consistent for the join week; it is
  existing behavior for full weeks.

## Out of scope

- Changing the flat-goal semantics for full weeks.
- Snapshotting goals per week.
- The corrected re-backfill (separate approval).
- Broader money-model changes (partial settlements, per-group weekly_goal).
