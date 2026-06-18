---
phase: 01-onboarding-data-foundation
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/app/api/onboarding-progress/route.ts
  - src/lib/onboarding-progress.test.ts
  - src/lib/onboarding-progress.ts
  - supabase/migrations/0030_onboarding_progress.sql
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the onboarding-progress data foundation: the Zod schema + pure merge
module (`src/lib/onboarding-progress.ts`), its co-located tests, the API route
handler, and the migration that creates the table, RLS policies, backfill, and
the extended `handle_new_user()` trigger.

The pure-logic layer is clean and well-tested, the RLS policies are correctly
owner-scoped, and the migration carefully preserves the prior `handle_new_user()`
body. The central defect is a **read-modify-write race in the PATCH handler**:
because the route reads the current row in one round-trip and upserts the merged
result in another, concurrent PATCHes can silently drop `completed_steps`
entries — the exact append-idempotency the module advertises is not preserved
under concurrency. There are also a few robustness and consistency gaps worth
addressing.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: PATCH read-modify-write race drops `completed_steps` entries

**File:** `src/app/api/onboarding-progress/route.ts:55-79`
**Issue:** The handler reads the existing row (`select ... maybeSingle()`), merges
in JS via `mergeProgress`, then writes the whole row back with `upsert`. This
read-merge-write is not atomic. Two PATCHes that arrive close together (e.g. the
client fires `complete_step: "gym"` and `complete_step: "money"` back-to-back, or
a double-tap / retry) both read the same pre-state, each appends only its own key,
and the second `upsert` overwrites the first — the lost-update problem. The whole
purpose of the server-authoritative dedupe-append (D-04) is defeated precisely
when two appends overlap. The `onConflict: "user_id"` upsert replaces the entire
row including `completed_steps`, so there is no DB-level merge to save it.

The onboarding flow is plausibly concurrent: the walkthrough commonly records
multiple step completions in quick succession, and PWA clients retry on flaky
mobile networks.

**Fix:** Make the append atomic at the database layer instead of read-merge-write
in JS. Options, in order of preference:

1. Add a Postgres function that appends with dedupe in a single statement and call
   it via RPC, e.g.:
   ```sql
   create or replace function public.append_onboarding_step(
     p_step text, p_last_step_id text, p_mandatory_done boolean,
     p_dismissed boolean, p_completed_at timestamptz
   ) returns public.onboarding_progress
   language sql security invoker as $$
     insert into public.onboarding_progress (user_id, completed_steps, last_step_id,
       mandatory_done, dismissed, completed_at)
     values (auth.uid(),
       case when p_step is null then '[]'::jsonb else jsonb_build_array(p_step) end,
       p_last_step_id, coalesce(p_mandatory_done, false),
       coalesce(p_dismissed, false), p_completed_at)
     on conflict (user_id) do update set
       completed_steps = case
         when p_step is null then onboarding_progress.completed_steps
         when onboarding_progress.completed_steps @> to_jsonb(p_step)
           then onboarding_progress.completed_steps
         else onboarding_progress.completed_steps || jsonb_build_array(p_step) end,
       last_step_id = coalesce(p_last_step_id, onboarding_progress.last_step_id),
       ...
     returning *;
   $$;
   ```
   This makes the dedupe-append a single atomic upsert and eliminates the lost
   update. Keep `mergeProgress` for unit-testing the dedupe logic if desired, but
   do not rely on the two-round-trip path for correctness.
2. If staying in JS, at minimum wrap read+write in a transaction with row-level
   locking — not directly available through the supabase-js query builder, which
   is why the RPC approach is preferred.

## Warnings

### WR-01: `completed_steps` array has no upper bound — unbounded growth

**File:** `src/lib/onboarding-progress.ts:72-89`, `supabase/migrations/0030_onboarding_progress.sql:11`
**Issue:** Each distinct, regex-valid `complete_step` is appended forever; there
is no cap on the number of entries and no allow-list of known step keys. A client
(or a compromised session) can append up to a very large number of distinct
40-char keys, growing the jsonb column without limit. The regex only constrains
the shape of each key, not the cardinality of the set. While RLS scopes this to
the caller's own row, it is still durable storage growth driven by unvalidated
client vocabulary.
**Fix:** Constrain the step vocabulary to a known set rather than an open regex —
validate `complete_step` against an enum/allow-list of the actual onboarding step
ids, or add a length guard in `mergeProgress` (e.g. cap `completed_steps.length`
and ignore appends past the cap). An allow-list also prevents typo'd keys from
silently polluting durable state.

### WR-02: PATCH never auto-stamps `completed_at` when onboarding completes

**File:** `src/lib/onboarding-progress.ts:79-88`, `src/app/api/onboarding-progress/route.ts:75-79`
**Issue:** `completed_at` is only ever set when the client explicitly sends it.
Nothing ties `completed_at` to `mandatory_done` becoming `true`. A client can set
`mandatory_done: true` while leaving `completed_at: null` (or set a
client-supplied, forgeable timestamp). For a server-authoritative model, the
completion timestamp should not be a client-trusted free string. This is an
inconsistency the backfill itself acknowledges — it stamps `completed_at = now()`
for already-complete profiles, but the live write path does not.
**Fix:** Derive `completed_at` server-side: when the patch transitions
`mandatory_done` from false to true and `completed_at` is currently null, set it
to the server clock (DB `now()` in the RPC, or `new Date().toISOString()` in the
handler). Drop `completed_at` from the client-writable `PatchBody`, or treat the
client value as advisory only.

### WR-03: GET/PATCH responses use different shapes for the same resource

**File:** `src/app/api/onboarding-progress/route.ts:37,88`
**Issue:** `GET` returns the bare `ProgressRow` (or `defaultProgress()`), but
`PATCH` returns `{ ok: true, progress: data }`. A client reading the progress
after a write has to special-case the envelope. The shapes also differ in the
missing-row default: GET synthesizes a default object, PATCH always returns the
persisted row. Inconsistent contracts on the same endpoint are a common source of
client bugs.
**Fix:** Return the same top-level shape from both verbs — either both bare
`ProgressRow`, or both wrapped. Given GET returns bare, prefer returning the bare
row from PATCH too (the upsert already `.select(SELECT_COLS).single()`).

### WR-04: `upsert(...).single()` will 500 if the row is concurrently deleted

**File:** `src/app/api/onboarding-progress/route.ts:75-86`
**Issue:** `.single()` errors when zero rows are returned. The `delete` RLS policy
allows the owner to delete their own row; if a delete races with this upsert, or
under unusual conflict handling, `.single()` surfaces as a generic `db_error`/500
rather than a meaningful state. More broadly, the handler assumes the upsert always
yields exactly one row.
**Fix:** Use `.maybeSingle()` and handle the null case explicitly (it should not
happen for an upsert, but defensive handling avoids an opaque 500), or document
why `.single()` is guaranteed safe here. Consider whether the owner `delete`
policy is even needed for this resource — removing it shrinks the surface.

## Info

### IN-01: `tour_version` is unreachable by any write path

**File:** `src/lib/onboarding-progress.ts:81`, `supabase/migrations/0030_onboarding_progress.sql:9`
**Issue:** `mergeProgress` always copies `tour_version` from `existing`, and
`PatchBody` has no `tour_version` field. The column defaults to `1` and there is
no code path (API or migration) that ever changes it. If a future tour version
bump is intended to re-trigger onboarding, the mechanism does not yet exist; the
field is currently inert. If that is deliberate (server-managed later), a brief
comment would prevent confusion.
**Fix:** Add a comment noting `tour_version` is reserved for a future
server-driven re-onboarding mechanism, or drop it until needed.

### IN-02: jsonb column typed as `string[]` in TS with no runtime guard on read

**File:** `src/lib/onboarding-progress.ts:42`, `src/app/api/onboarding-progress/route.ts:37,70-71`
**Issue:** `completed_steps jsonb` is asserted as `string[]` via the
`as ProgressRow` cast. The merge spreads it (`[...existing.completed_steps]`) and
calls `.includes`. If the stored jsonb were ever a non-array (only reachable via
direct DB manipulation given current write paths), the spread/`.includes` would
throw or misbehave. The type cast hides this from the compiler.
**Fix:** Acceptable given all writes go through the typed path, but a defensive
`Array.isArray(existing.completed_steps) ? existing.completed_steps : []` in
`mergeProgress` would harden against malformed rows at negligible cost.

### IN-03: Test coverage omits the regex anchoring / newline edge case

**File:** `src/lib/onboarding-progress.test.ts:40-46`
**Issue:** The `STEP_KEY_REGEX` tests cover uppercase, punctuation, empty, and
over-long, but not the classic anchor-bypass cases (embedded/trailing newline,
e.g. `"gym\n"` or `"admin\nx"`). Manual verification confirms the regex correctly
rejects these (no `m` flag, `{1,40}` spans the whole match), but a regression test
would lock that behavior in, since step keys flow into durable storage.
**Fix:** Add assertions: `expect(STEP_KEY_REGEX.test("gym\n")).toBe(false)` and
`expect(STEP_KEY_REGEX.test("a\nb")).toBe(false)`.

---

_Reviewed: 2026-06-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
