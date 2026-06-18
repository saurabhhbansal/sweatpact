---
phase: 01-onboarding-data-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, rls, migration, onboarding, trigger]

# Dependency graph
requires:
  - phase: 00-bootstrap
    provides: "profiles table + profiles.onboarding_complete column (0014) + handle_new_user() trigger and profile_secrets (0016)"
provides:
  - "public.onboarding_progress table — one durable row per user, server-side source of truth for tour state"
  - "Owner-only RLS on all four verbs (select/insert/update/delete) scoped to authenticated, auth.uid() = user_id"
  - "tour_version field (default 1) for stale-version detection on later replay"
  - "D-02 backfill seeding every existing profile (done-row if onboarding_complete, else blank row)"
  - "Extended handle_new_user() trigger auto-provisioning a progress row for every new profile"
affects: [onboarding-progress-api, walkthrough-engine, tour-replay, mandatory-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-row-per-user table keyed on user_id PK (mirrors profile_secrets) for onConflict upsert targeting"
    - "Owner-only RLS via auth.uid() = user_id on all four verbs, to authenticated"
    - "Idempotent migration (if not exists / drop policy if exists / on conflict do nothing / create or replace)"

key-files:
  created:
    - supabase/migrations/0030_onboarding_progress.sql
  modified: []

key-decisions:
  - "D-03: onboarding_progress is the source of truth for tour state going forward; profiles.onboarding_complete is read ONLY at backfill time to seed it, never as runtime tour state"
  - "D-02: backfill seeds onboarding_complete=true users as done-rows (mandatory_done=true, dismissed=true, completed_at=now()) so they are never re-tutorialized; everyone else gets a blank row"
  - "D-01 (Option A): handle_new_user() extended in place — profiles + profile_secrets inserts preserved verbatim, onboarding_progress insert added before return new"

patterns-established:
  - "Owner-only RLS table: user_id PK FK to profiles, RLS enabled, four named policies (select/insert/update/delete)_own, all to authenticated with auth.uid() = user_id"
  - "Fully idempotent migration safe to re-run (if not exists, drop policy if exists, on conflict do nothing, create or replace)"

requirements-completed: [PROG-01, PROG-04]

# Metrics
duration: ~5min
completed: 2026-06-15
---

# Phase 01 Plan 01: Onboarding Data Foundation Summary

**`onboarding_progress` table (one durable row per user) with owner-only RLS on all four verbs, a tour_version field for stale-version detection, D-02 backfill of existing profiles, and an extended handle_new_user() trigger — applied to and verified against the live Supabase database.**

## Performance

- **Duration:** ~5 min (continuation: SUMMARY + state, after Task 1 commit and orchestrator-applied migration)
- **Tasks:** 2
- **Files created:** 1

## Accomplishments
- `public.onboarding_progress` created — one row per user, `user_id uuid` PK → `public.profiles(id) on delete cascade`, plus `mandatory_done`, `tour_version`, `last_step_id`, `completed_steps`, `dismissed`, `completed_at`.
- Owner-only RLS enabled with four named policies (`onboarding_progress_{select,insert,update,delete}_own`), all `to authenticated` with `auth.uid() = user_id`.
- `tour_version integer not null default 1` persisted so later replay can detect stale tour versions (PROG-04).
- D-02 backfill seeded 8 rows (one per existing profile); `onboarding_complete=true` users seeded as done-rows.
- `handle_new_user()` extended (D-01 Option A) to auto-provision a progress row for every new profile, preserving the existing `profiles` and `profile_secrets` inserts.
- Migration applied to and verified against the live Supabase database (Task 2 blocking checkpoint, user-approved).

## Task Commits

1. **Task 1: Write the onboarding_progress migration (table + RLS + backfill + trigger)** - `84f832f` (feat)
2. **Task 2: [BLOCKING] Apply migration 0030 to the live database and verify table + RLS** - orchestrator-applied via Supabase MCP `apply_migration` (returned `{"success":true}`); no code commit (DB-state operation, user-approved checkpoint)

## Files Created/Modified
- `supabase/migrations/0030_onboarding_progress.sql` - Creates `onboarding_progress` table + four owner-only RLS policies + D-02 backfill + extended `handle_new_user()` trigger; fully idempotent.

## Live-DB Verification (Task 2)

Verified against the live Supabase project via Supabase MCP after `apply_migration` returned success:

- `public.onboarding_progress` exists with **RLS enabled**; 7 columns at correct defaults: `user_id` PK uuid → `profiles.id`; `mandatory_done` bool default false; `tour_version` int default 1; `last_step_id` text nullable; `completed_steps` jsonb default `'[]'`; `dismissed` bool default false; `completed_at` timestamptz nullable.
- FK `onboarding_progress_user_id_fkey` → `public.profiles.id` present.
- Four owner-only RLS policies confirmed via `pg_policies`, all `to authenticated`, one per verb: `onboarding_progress_select_own` (SELECT), `onboarding_progress_insert_own` (INSERT), `onboarding_progress_update_own` (UPDATE), `onboarding_progress_delete_own` (DELETE).
- D-02 backfill seeded **8 rows** (= 8 existing profiles).
- `get_advisors` (security): **NO** `rls_disabled_in_public` advisory for `onboarding_progress`. The pre-existing `handle_new_user` SECURITY DEFINER advisory is NOT a regression — it predates this migration and applies to several existing functions.

## Decisions Made
- **D-03 (source of truth):** `onboarding_progress` is the runtime source of truth for tour state going forward. `profiles.onboarding_complete` is read ONLY at backfill time to seed initial rows, never consulted as live tour state thereafter.
- **D-02 (backfill semantics):** `onboarding_complete=true` profiles seed as done-rows so existing users are never re-tutorialized; all others get blank rows. `on conflict (user_id) do nothing` makes the backfill idempotent.
- **D-01 Option A (trigger extension):** `handle_new_user()` redefined via `create or replace`, copying the existing `profiles` and `profile_secrets` inserts verbatim and adding only the `onboarding_progress` insert before `return new`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Task 2 was a planned blocking human-verify checkpoint; the migration was applied by the orchestrator via Supabase MCP and approved by the user against verified live-DB state.

## User Setup Required
None - no external service configuration required. The migration is already live in the Supabase project.

## Next Phase Readiness
- Data foundation complete: every user (existing and new) has an `onboarding_progress` row, owner-scoped via RLS.
- Plan 01-02 (and later onboarding phases) can build the read/write API against this table with no admin/service-role client (owner-scoped RLS governs all access — D-03).
- No blockers introduced.

## Self-Check: PASSED

- FOUND: `supabase/migrations/0030_onboarding_progress.sql`
- FOUND: `.planning/phases/01-onboarding-data-foundation/01-01-SUMMARY.md`
- FOUND: Task 1 commit `84f832f`

---
*Phase: 01-onboarding-data-foundation*
*Completed: 2026-06-15*
