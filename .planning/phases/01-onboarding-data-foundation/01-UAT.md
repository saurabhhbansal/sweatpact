---
status: testing
phase: 01-onboarding-data-foundation
source: [01-VERIFICATION.md]
started: 2026-06-15T07:27:25Z
updated: 2026-06-15T07:27:25Z
---

## Current Test

number: 1
name: Live DB state confirmation — onboarding_progress table + owner-only RLS exist in the live Supabase project
expected: |
  public.onboarding_progress exists in the live database with RLS enabled, all
  seven columns at the documented defaults, the four owner-only policies
  (select/insert/update/delete_own, to authenticated), the FK to profiles.id, and
  a D-02 backfill row per existing profile. No rls_disabled_in_public advisory for
  the table.
  NOTE: Already confirmed by the orchestrator this session via Supabase MCP
  (apply_migration success → list_tables shows table + RLS + 7 cols; pg_policies
  shows 4 owner-only policies; backfill seeded 8 rows = 8 profiles; get_advisors
  shows no rls_disabled advisory). This item exists because the verifier agent
  could not independently re-query Supabase. Confirm via dashboard/MCP to close.
awaiting: user response

## Tests

### 1. Live DB state confirmation — onboarding_progress table + owner-only RLS exist in the live Supabase project
expected: |
  public.onboarding_progress present in live DB; RLS enabled; 7 columns at correct
  defaults; 4 owner-only policies (to authenticated, auth.uid() = user_id); FK to
  profiles.id; backfill row per existing profile; no rls_disabled_in_public advisory.
  (Already MCP-confirmed by the orchestrator — see note above.)
result: [pending]

### 2. CR-01 concurrency decision — non-atomic PATCH read-modify-write
expected: |
  Decide whether the PATCH handler's read-modify-write upsert is acceptable as-is
  for the onboarding walkthrough, or whether it must be made atomic before Phase 2.
  Context: GET-then-merge-then-upsert is not atomic. The single-replay no-op
  (same body twice) is proven by tests and holds. The race is two CONCURRENT
  PATCHes with DIFFERENT step keys (e.g. a mobile retry overlapping a fresh write):
  both read the same pre-state, the second upsert overwrites the first, losing one
  completed_steps entry. Fix (per 01-REVIEW.md CR-01): atomic dedupe-append via a
  Postgres RPC using `on conflict ... do update set completed_steps =
  completed_steps || jsonb_build_array(...)` guarded by a `@>` containment check.
  PASS = "accept as-is for now" (single-user sequential onboarding makes overlap
  rare). FAIL = "must fix CR-01 before Phase 2" → run gap closure
  (/gsd-plan-phase 01 --gaps) or /gsd-code-review 01 --fix.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
