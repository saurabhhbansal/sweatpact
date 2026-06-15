---
phase: 01-onboarding-data-foundation
verified: 2026-06-15T12:54:30Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm live DB table + RLS state"
    expected: "public.onboarding_progress exists in Supabase with RLS enabled, all four owner-only policies present, no rls_disabled_in_public advisory, and a scoped owner-only select returns only the caller's row"
    why_human: "Live DB state cannot be asserted from a local test command; was verified during Task 2 checkpoint per SUMMARY, but verifier cannot independently re-query Supabase without MCP credentials in this session"
  - test: "Concurrent PATCH overlap behavior — CR-01"
    expected: "Decide whether the read-modify-write race identified in CR-01 (two concurrent PATCH calls can silently lose one append when they both read the same pre-state) is acceptable for the current onboarding flow, or requires an atomic Postgres RPC fix before proceeding to Phase 2"
    why_human: "The single-replay idempotency guarantee (SC-2) is verified by tests and code. The race is a separate scenario — two *different* step keys arriving concurrently from the same session — which the code does not protect against and which can cause a lost update. Whether this risks the phase goal depends on the expected concurrency pattern of the walkthrough. The code reviewer (CR-01) flagged this Critical. A human must decide: accept the race risk (and track as a debt item), or block Phase 2 on an atomic fix."
---

# Phase 01: Onboarding Data Foundation — Verification Report

**Phase Goal:** Walkthrough progress is durably persisted per user server-side, with an idempotent, validated read/write path that survives interruption and works across devices.
**Verified:** 2026-06-15T12:54:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new `onboarding_progress` row exists per user, readable/writable only by its owner (RLS verified), capturing mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at | VERIFIED (DB state: human-confirmed per SUMMARY; migration code: fully verified) | `0030_onboarding_progress.sql` — table DDL contains all 7 columns at correct types/defaults; 4 owner-only RLS policies present in SQL; SUMMARY documents live-DB MCP verification (8 backfill rows, RLS enabled, no security advisory). Migration code verified line-by-line. |
| 2 | GET /api/onboarding-progress returns the caller's current progress; PATCH records advancement and is idempotent on additive completed_steps appends (replaying the same write is a no-op) | VERIFIED (single-replay idempotency); WARNING on concurrent-append race (CR-01) | Route reads own row then merges via `mergeProgress`; `mergeProgress` dedupe-appends verified by 3 test cases (replay no-op, twice-applied, additive order). Concurrent overlapping PATCHes are NOT protected — read-modify-write is non-atomic (CR-01, see Human Verification). |
| 3 | All writes are Zod-validated and reject malformed step keys or unknown fields | VERIFIED | `PatchBody` is `.strict()` (rejects unknown fields); `complete_step` and `last_step_id` validated against `STEP_KEY_REGEX` (`/^[a-z0-9_]{1,40}$/`). Test cases confirm: unknown field `{ foo:1 }` → false; malformed keys (uppercase, punctuation, too-long, empty) → false; valid key → true. PATCH calls `PatchBody.safeParse(...)` before any DB operation. |
| 4 | The persisted `tour_version` is present so a later replay can detect stale versions without breaking | VERIFIED | `tour_version integer not null default 1` in migration DDL; `mergeProgress` always carries `tour_version` from the existing row unchanged; `defaultProgress()` returns `tour_version: 1`; `SELECT_COLS` in route includes `tour_version` in both GET and PATCH responses; test case `"preserves tour_version from the existing row"` covers this. |

**Score:** 4/4 truths verified (concurrent-race issue is a WARNING within truth 2, not a truth failure — single-replay idempotency itself is solid)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0030_onboarding_progress.sql` | Table + 4 RLS policies + D-02 backfill + extended `handle_new_user()` | VERIFIED | File exists. Table: `create table if not exists public.onboarding_progress` with all 7 columns. Exactly 4 `create policy` statements (select/insert/update/delete)_own, all `to authenticated`. Backfill: `insert ... select` from `public.profiles` reading `onboarding_complete`, `on conflict (user_id) do nothing`. Trigger: `handle_new_user()` preserves `insert into public.profiles` and `insert into public.profile_secrets` verbatim and adds `insert into public.onboarding_progress (user_id) values (new.id) on conflict (user_id) do nothing`. Migration is fully idempotent (`if not exists`, `drop policy if exists`, `create or replace`). |
| `src/lib/onboarding-progress.ts` | Pure Zod schema + dedupe/append/merge helpers | VERIFIED | Exports confirmed: `STEP_KEY_REGEX`, `PatchBody` (`.strict()`), `PatchInput` type, `ProgressRow` type, `ProgressResponse` type, `defaultProgress()`, `mergeProgress()`. No Supabase imports (pure/DB-free). `mergeProgress` uses spread `[...existing.completed_steps]` (no mutation). |
| `src/lib/onboarding-progress.test.ts` | Vitest coverage: replay no-op, dedupe, unknown-field reject, bad-key reject, missing-row default | VERIFIED | 20 test cases, all passing (`npx vitest run` exit 0, verified by running test suite). Covers: `defaultProgress` shape and fresh-array guarantee; `STEP_KEY_REGEX` accept/reject; `PatchBody` accept/reject/strict/full-array-reject; `mergeProgress` all 8 behaviors from plan spec. |
| `src/app/api/onboarding-progress/route.ts` | GET (defensive default) + PATCH (Zod-validated idempotent upsert) | VERIFIED | Exports: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `GET`, `PATCH`. Imports `createClient` from `@/lib/supabase/server` (not admin). Imports `PatchBody`, `mergeProgress`, `defaultProgress` from `@/lib/onboarding-progress`. GET: `auth.getUser()` 401 guard → `select(SELECT_COLS).eq("user_id").maybeSingle()` → returns `data ?? defaultProgress()` — never 404/500. PATCH: 401 guard → `PatchBody.safeParse` → 400 on failure → read own row → `mergeProgress` → `upsert({ user_id, ...merged }, { onConflict: "user_id" }).select.single()` → `{ ok:true, progress:data }`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `public.handle_new_user()` | `public.onboarding_progress` | `insert ... on conflict (user_id) do nothing` | VERIFIED | Line 72 of migration: `insert into public.onboarding_progress (user_id) values (new.id) on conflict (user_id) do nothing;` present before `return new`. Profiles and profile_secrets inserts also present (lines 59, 68). |
| Backfill insert...select | `public.profiles.onboarding_complete` | conditional done-row vs blank-row seed (D-02) | VERIFIED | Lines 44-46 of migration: `case when onboarding_complete then true else false end` used for `mandatory_done` and `dismissed`; `case when onboarding_complete then now() else null end` for `completed_at`. |
| `src/app/api/onboarding-progress/route.ts` | `src/lib/onboarding-progress.ts` | imports `PatchBody`, `mergeProgress`, `defaultProgress` | VERIFIED | Single import line 3-8 in route: `import { PatchBody, mergeProgress, defaultProgress, type ProgressRow } from "@/lib/onboarding-progress"`. All three symbols used in the route body. |
| `src/app/api/onboarding-progress/route.ts` | `public.onboarding_progress` | `.from("onboarding_progress")` | VERIFIED | Three `.from("onboarding_progress")` calls: line 24 (GET select), line 57 (PATCH read), line 76 (PATCH upsert). |

---

### Data-Flow Trace (Level 4)

This phase produces an API route (not a rendering component), so Level 4 is adapted to trace the data path through the route to the DB and back.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `route.ts` GET | `data` (ProgressRow | null) | `supabase.from("onboarding_progress").select(SELECT_COLS).eq("user_id", auth.user.id).maybeSingle()` | Yes — owner-scoped select from live table | FLOWING |
| `route.ts` PATCH | `existing` read → `mergeProgress` → upsert | Same table, then `upsert({ user_id, ...merged }, { onConflict: "user_id" })` | Yes — reads live row, writes merged row, returns updated row via `.select(SELECT_COLS).single()` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 20-case test suite covering all must-have behaviors | `npx vitest run src/lib/onboarding-progress.test.ts --pool=threads` | 20 passed, 0 failed, exit 0 | PASS |
| Helper exports all required symbols | `node -e "const m = require('./src/lib/onboarding-progress.ts'); console.log(Object.keys(m))"` (via tsx) | `[ 'PatchBody', 'STEP_KEY_REGEX', 'defaultProgress', 'mergeProgress' ]` | PASS |
| Commit hashes cited in SUMMARY exist | `git log --oneline 84f832f 8b48e6f f0fa6be` | All three present with expected descriptions | PASS |
| TypeScript: no errors in `src/` | `npx tsc --noEmit 2>&1 \| grep "^src/"` | Zero lines — all errors are `.next/` stale build artifacts (gitignored, pre-existing, unrelated) | PASS |
| No debt markers in phase files | `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" <phase-files>` | Zero matches across all 4 phase files | PASS |
| Route does not import admin client | `grep -n "createAdminClient\|admin" src/app/api/onboarding-progress/route.ts` | No matches — only `createClient` from `@/lib/supabase/server` | PASS |
| Exactly 4 RLS policies in migration | `grep -c "create policy" supabase/migrations/0030_onboarding_progress.sql` | 4 | PASS |

---

### Probe Execution

No probe scripts declared in PLAN files. No conventional `scripts/*/tests/probe-*.sh` patterns apply. Step skipped.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROG-01 | 01-01-PLAN, 01-02-PLAN | Walkthrough progress is persisted server-side per user, so it resumes after interruption and across devices | SATISFIED | `onboarding_progress` table (one row per user, owner-RLS) + GET/PATCH API with upsert semantics — any device can read/write the same row for the same user |
| PROG-04 | 01-01-PLAN, 01-02-PLAN | Replay handles walkthrough version changes gracefully without breaking on stale/removed step targets | SATISFIED | `tour_version integer not null default 1` in DB; surfaced in GET response via `SELECT_COLS`; `mergeProgress` preserves it from existing row; `defaultProgress()` returns `tour_version: 1` as safe baseline |

REQUIREMENTS.md traceability table marks both PROG-01 and PROG-04 as "Complete" mapped to Phase 1. Both are confirmed satisfied by codebase evidence. No orphaned requirement IDs.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No debt markers (`TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`), no stub returns, no empty handlers found in any phase-modified file.

---

### Human Verification Required

#### 1. Live Database State Confirmation

**Test:** Query the live Supabase project and confirm: (a) `public.onboarding_progress` table exists with RLS enabled, (b) all four policies (`onboarding_progress_{select,insert,update,delete}_own`) are present, (c) `get_advisors` security check shows no `rls_disabled_in_public` advisory for `onboarding_progress`, (d) an owner-scoped select returns only the caller's row and cross-user reads return nothing.

**Expected:** All four conditions true — consistent with what SUMMARY 01-01 documents from the Task 2 blocking checkpoint.

**Why human:** Live DB state cannot be asserted by a local test command. The verifier cannot independently invoke the Supabase MCP in this session. The SUMMARY documents user-approved verification at the Task 2 checkpoint, but the verifier's mandate is to not trust SUMMARY claims. If a human can confirm the live DB state via Supabase dashboard or MCP, this item closes.

---

#### 2. CR-01 Concurrency Decision

**Test:** Review the PATCH handler race condition documented in code review finding CR-01 (`src/app/api/onboarding-progress/route.ts:55-79`). The handler performs a non-atomic read-modify-write: it reads the current row in one round-trip, merges in JS, and upserts in a second round-trip. Two concurrent PATCHes with different step keys (e.g., `complete_step: "gym"` and `complete_step: "money"` fired back-to-back) will both read the same pre-state, each produce a merged row with only their own key appended, and the second upsert will overwrite the first — silently dropping one step entry.

**Expected decision path:**
- **Accept the risk:** The onboarding walkthrough is intentionally sequential (one step at a time), making the concurrent-different-key scenario unlikely in practice. Track as a deferred improvement (e.g., atomic RPC in a follow-up migration). Phase 2 can proceed.
- **Block on fix:** If PWA retry behavior on flaky mobile networks can realistically produce the race (a retry of step A overlapping with a fresh write of step B), the atomic fix described in CR-01 (Postgres RPC with `on conflict do update ... || jsonb_build_array(p_step)`) should be implemented before Phase 2 builds on this foundation.

**Why human:** Whether the race is acceptable depends on the intended UX flow concurrency model, which only the product owner can decide. The single-replay idempotency guarantee (same body replayed) is verified and works correctly. The risk is specifically two *different* step keys arriving concurrently, which the current code does not protect against.

---

### Gaps Summary

No hard gaps — all 4 must-have truths are VERIFIED by codebase evidence. Two items require human decision:

1. **Live DB confirmation:** SUMMARY documents it was done, but the verifier cannot independently re-confirm without Supabase MCP access in this session. If the developer can confirm the live table + RLS state, this item is closed.

2. **CR-01 concurrency:** Not a failure of the idempotency must-have (single-replay is solid), but a robustness gap in the concurrent-different-key path that the code reviewer flagged Critical. Human must decide whether to accept or fix before Phase 2.

---

_Verified: 2026-06-15T12:54:30Z_
_Verifier: Claude (gsd-verifier)_
