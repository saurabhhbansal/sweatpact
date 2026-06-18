---
phase: 01-onboarding-data-foundation
plan: 02
subsystem: onboarding-progress-api
tags: [api-route, zod, supabase, rls, idempotent, vitest, onboarding]

# Dependency graph
requires:
  - phase: 01-onboarding-data-foundation
    provides: "public.onboarding_progress table (live) with owner-only RLS on all four verbs, user_id PK, 7 columns (Plan 01-01)"
provides:
  - "GET /api/onboarding-progress — reads caller's own row, defensive defaultProgress() on missing row (no 404/500)"
  - "PATCH /api/onboarding-progress — Zod-validated, server-authoritative idempotent upsert on user_id"
  - "src/lib/onboarding-progress.ts — pure, DB-free Zod schema + dedupe/append/merge helpers (the testable seam)"
  - "STEP_KEY_REGEX + strict PatchBody schema rejecting unknown fields and malformed step keys"
affects: [walkthrough-engine, tour-replay, mandatory-onboarding, onboarding-resume]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure src/lib helper as the only testable seam; route handler stays untested per project convention"
    - "Strict Zod object (.strict()) at the API boundary rejects unknown fields (T-01-06)"
    - "Server-authoritative GET-then-merge-then-upsert: client sends a single step key, never a full array (D-04)"
    - "Non-admin createClient() with .eq(user_id) + pinned upsert payload; owner RLS is the enforcement boundary"

key-files:
  created:
    - src/lib/onboarding-progress.ts
    - src/lib/onboarding-progress.test.ts
    - src/app/api/onboarding-progress/route.ts
  modified: []

key-decisions:
  - "D-04: PATCH accepts a single semantic complete_step key (dedupe-appended server-side), never a client-sent full completed_steps array — replay is a no-op"
  - "Owner RLS suffices: route uses non-admin createClient() only; never imports createAdminClient (T-01-07)"
  - "Missing-row case returns a neutral defaultProgress() shape (D-01) rather than 404/500"

requirements-completed: [PROG-01, PROG-04]

# Metrics
duration: ~2min
completed: 2026-06-15
---

# Phase 01 Plan 02: Onboarding Progress Read/Write API Summary

**GET/PATCH `/api/onboarding-progress` route backed by a pure, unit-tested `src/lib/onboarding-progress.ts` helper — strict Zod validation, defensive missing-row default, and server-authoritative idempotent dedupe-append against the live owner-RLS table.**

## Performance

- **Duration:** ~2 min
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- `src/lib/onboarding-progress.ts` — pure, DB-free helper exporting `STEP_KEY_REGEX` (`/^[a-z0-9_]{1,40}$/`), the strict `PatchBody` Zod schema, `defaultProgress()`, and the idempotent `mergeProgress()` dedupe-append, plus `ProgressRow`/`ProgressResponse` types.
- `src/lib/onboarding-progress.test.ts` — 20-case Vitest suite (style-matched to `derived-status.test.ts`) covering replay no-op, dedupe/append order, optional-scalar application, explicit-null application, no-mutation guarantee, unknown-field rejection, bad-key rejection (uppercase/punctuation/too-long/empty), valid-key acceptance, full-array rejection, and the missing-row default shape. Exits 0.
- `src/app/api/onboarding-progress/route.ts` — `GET` (read own row, defensive `defaultProgress()` on missing) and `PATCH` (Zod-validate → read own row → `mergeProgress` → upsert `onConflict: "user_id"` → return updated row). `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Uses the non-admin `createClient()` only; never imports `createAdminClient`. All DB ops `.eq("user_id", auth.user.id)` and the upsert payload pins `user_id` to `auth.user.id` — owner RLS is the enforcement boundary (T-01-07).
- `npx tsc --noEmit` clean for `src/`; ESLint reports no warnings/errors on the new route.

## Task Commits

1. **Task 1: Pure merge/validation helper + Vitest coverage** - `8b48e6f` (feat)
2. **Task 2: GET + PATCH route handler wired to the helper and live table** - `f0fa6be` (feat)

## Files Created/Modified
- `src/lib/onboarding-progress.ts` - Pure Zod schema + dedupe/append/merge helpers; imports nothing from `@/lib/supabase/*`.
- `src/lib/onboarding-progress.test.ts` - Co-located Vitest suite (20 cases), all passing.
- `src/app/api/onboarding-progress/route.ts` - GET (defensive default) + PATCH (idempotent upsert) wired to the helper and the live `onboarding_progress` table.

## Decisions Made
- **D-04 (server-authoritative dedupe):** PATCH accepts at most a single `complete_step` key per write; `mergeProgress` dedupe-appends it server-side. Clients cannot send a full `completed_steps` array (`.strict()` rejects it), so concurrent replays are no-ops and cannot corrupt the array (T-01-08).
- **Owner RLS only:** the route never uses the service-role client; caller identity is scoped via `.eq("user_id", auth.user.id)` plus the owner-only RLS from Plan 01-01 (T-01-07, T-01-10).
- **Missing-row default (D-01):** GET returns the neutral `defaultProgress()` shape rather than 404/500 when no row exists.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied
- **T-01-06 (malformed/unknown-field injection):** `PatchBody` is `.strict()` with `STEP_KEY_REGEX` on `complete_step`/`last_step_id`; bad bodies → `validation_failed` 400 (unit-tested).
- **T-01-07 (cross-user write):** non-admin client; all ops `.eq("user_id", auth.user.id)`; upsert pins `user_id`.
- **T-01-08 (concurrent replay corruption):** server-authoritative GET-then-dedupe-then-upsert; replay is a no-op.
- **T-01-09 (unauthenticated access):** `auth.getUser()` 401 guard on both GET and PATCH before any DB work.
- **T-01-10 (info disclosure):** `.eq("user_id", ...)` + owner RLS; missing row returns a neutral default, never another user's data.

## Issues Encountered
None blocking. `npx tsc --noEmit` surfaces stale `.next/types/app/**/page.ts` "Cannot find module ... page.js" errors — these come from gitignored generated build artifacts (`.next` is gitignored), reference page modules unrelated to this plan, and predate it. No type errors originate from `src/`.

## User Setup Required
None - no external service configuration required. The route reads/writes the already-live `onboarding_progress` table via owner RLS.

## Next Phase Readiness
- The validated, idempotent read/write path PROG-01 requires is live: onboarding state survives interruption, works across devices, and is server-authoritative.
- The pure `mergeProgress`/`PatchBody` seam is reusable by the walkthrough engine and tour-replay phases.
- `tour_version` is surfaced in the GET response for later stale-version detection (PROG-04).
- No blockers introduced.

## Self-Check: PASSED

- FOUND: `src/lib/onboarding-progress.ts`
- FOUND: `src/lib/onboarding-progress.test.ts`
- FOUND: `src/app/api/onboarding-progress/route.ts`
- FOUND: Task 1 commit `8b48e6f`
- FOUND: Task 2 commit `f0fa6be`

---
*Phase: 01-onboarding-data-foundation*
*Completed: 2026-06-15*
