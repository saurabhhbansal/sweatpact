-- Repair weekly penalty upserts.
--
-- Migration 0004 dropped the 3-column unique constraint
-- (user_id, local_day, reason) and replaced it with a 4-column EXPRESSION index
-- on (user_id, local_day, reason, coalesce(group_id, zero)). PostgREST cannot
-- target an expression index by a bare column list, so the application's
-- `.upsert(..., { onConflict: "user_id,local_day,reason" })` began failing with
-- Postgres 42P10 ("no unique or exclusion constraint matching the ON CONFLICT
-- specification"), silently breaking all weekly missed-goal penalty creation.
--
-- Add a plain (non-expression) unique index PostgREST can infer. group_id is
-- always non-null on the penalty-creation path (ensurePenaltyForGroup), so this
-- enforces the same uniqueness the app relies on. The existing expression index
-- is kept as-is; it still guards any hypothetical null-group rows.
create unique index if not exists penalty_events_user_day_reason_group_key
  on public.penalty_events (user_id, local_day, reason, group_id);
