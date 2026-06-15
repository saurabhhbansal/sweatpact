---
phase: 01
slug: onboarding-data-foundation
status: secured
threats_open: 0
threats_total: 10
threats_closed: 10
asvs_level: default
created: 2026-06-15
---

# SECURITY.md — Phase 01: Onboarding Data Foundation

**Audited:** 2026-06-15
**Auditor:** gsd-security-auditor (FORCE stance — mitigations assumed absent until proven by code)
**Scope:** Plans 01-01 (migration `0030_onboarding_progress.sql`) and 01-02 (`/api/onboarding-progress` route + pure helper)
**ASVS Level:** default
**Register source:** authored at plan time (`register_authored_at_plan_time: true`) — verification mode, NOT a fresh scan.

## Result

**SECURED — 10/10 threats CLOSED** (9 mitigations verified present in code; 1 mitigation verified present with a user-accepted residual risk logged below).

No BLOCKER (`OPEN_THREATS`). No `unregistered_flag` warnings (neither SUMMARY declares a `## Threat Flags` section; no new attack surface introduced beyond the registered threats).

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-01-01 | Information Disclosure | mitigate | CLOSED | `0030_onboarding_progress.sql:16` RLS enabled; `:19-33` four owner-only policies `for select/insert/update/delete to authenticated using/with check (auth.uid() = user_id)`. Live-DB verified per task brief (table + RLS + 4 policies via MCP; no `rls_disabled_in_public` advisory per 01-01-SUMMARY:82). |
| T-01-02 | Elevation of Privilege | mitigate | CLOSED | `route.ts:2` imports only `createClient` from `@/lib/supabase/server`. Grep for `createAdminClient`/`service.role`/`admin` in the route returns NO matches. Phase uses no service-role client. |
| T-01-03 | Tampering | mitigate | CLOSED | `0030_*.sql:59` `insert into public.profiles`, `:68` `insert into public.profile_secrets`, `:72` `insert into public.onboarding_progress` all present inside the `create or replace function public.handle_new_user()` body. Prior inserts preserved verbatim after redefinition. |
| T-01-04 | Information Disclosure | mitigate | CLOSED | `0030_*.sql:39-49` backfill is `insert into public.onboarding_progress (...) select id ... from public.profiles on conflict (user_id) do nothing` — keyed per-profile `id`, one row per existing user, no cross-user copy. |
| T-01-05 | Tampering | accept→mitigate | CLOSED | Full idempotency confirmed: `:6` `create table if not exists`; `:18,22,26,31` `drop policy if exists` before each policy; `:49,70,73` `on conflict (user_id) do nothing`; `:55` `create or replace function`. Safe to re-run. |
| T-01-06 | Tampering | mitigate | CLOSED | `onboarding-progress.ts:9` `STEP_KEY_REGEX = /^[a-z0-9_]{1,40}$/`; `:19,20-24` regex applied to `complete_step` and `last_step_id`; `:29` `.strict()` rejects unknown fields. `route.ts:47-52` malformed bodies → `validation_failed` 400. Unit-tested (suite passes 20/20: unknown-field reject, bad-key reject uppercase/punctuation/too-long/empty, full-array reject). |
| T-01-07 | Spoofing / EoP | mitigate | CLOSED | `route.ts:2` non-admin `createClient()`; `:26,59` `.eq("user_id", auth.user.id)` on both reads; `:77` upsert payload pins `user_id: auth.user.id` with `onConflict: "user_id"`; owner-only RLS (T-01-01) is the enforcement boundary. |
| T-01-08 | Tampering (concurrency) | mitigate | CLOSED (with accepted residual risk — see log) | `route.ts:69-79` server-authoritative GET→`mergeProgress`→upsert; client cannot send a full array (`.strict()` rejects `completed_steps`, test `:87-89`). Single-replay no-op proven: `onboarding-progress.test.ts:98-109` (`mergeProgress` replayed with same key yields exactly `["gym"]`). The proven no-op is intact. Residual lost-update under two CONCURRENT different-key PATCHes (01-REVIEW CR-01) is accepted — see Accepted Risks. |
| T-01-09 | Denial of Service | mitigate | CLOSED | `route.ts:18-21` (GET) and `:42-45` (PATCH) — `auth.getUser()` → `{ error: "unauthorized" }` 401 before any DB work. |
| T-01-10 | Information Disclosure | mitigate | CLOSED | `route.ts:23-27` GET selects `.eq("user_id", auth.user.id).maybeSingle()`; `:36-37` missing row returns neutral `defaultProgress()`, never another user's data; backed by owner RLS (T-01-01). |

## Unregistered Flags

None. Neither `01-01-SUMMARY.md` nor `01-02-SUMMARY.md` declares a `## Threat Flags` section. `01-02-SUMMARY.md` contains a `## Threat Mitigations Applied` section, all entries of which map to registered threat IDs (T-01-06 through T-01-10). No new attack surface appeared during implementation without a threat mapping.

## Accepted Risks Log

### AR-01 — T-01-08 residual: PATCH read-modify-write lost-update under concurrency

- **Threat:** T-01-08 (Tampering — concurrent PATCH corrupts `completed_steps`).
- **What is mitigated (CLOSED part):** The declared mitigation — server-authoritative GET-then-dedupe-then-upsert via the pure `mergeProgress`, with clients unable to send a full `completed_steps` array — is present and unit-tested. Replaying the **same** key is a proven no-op (`onboarding-progress.test.ts:98-109`). The single-replay idempotency the register claims is intact and verified.
- **Residual risk (ACCEPTED):** The read (`route.ts:56-60`) and the upsert (`route.ts:75-79`) are two separate round-trips with no row lock or DB-level merge. Two concurrent PATCHes with **different** keys (e.g. back-to-back `complete_step:"gym"` then `complete_step:"money"`, or a double-tap/retry on flaky mobile) can both read the same pre-state; the second upsert overwrites the first — a lost-update dropping one `completed_steps` entry. Identified as CR-01 (CRITICAL) in `01-REVIEW.md`.
- **Disposition:** User-ACCEPTED for the onboarding walkthrough (UAT Test 2 pass, per audit brief). The onboarding flow records step completions sequentially in practice; a dropped step is self-healing (the step can be re-completed) and carries no financial-correctness impact — it is outside the money/settlement path that the project marks as the one thing that must work.
- **Suggested remediation if revisited:** Move the dedupe-append into a single atomic statement — a `security invoker` Postgres RPC using `on conflict (user_id) do update set completed_steps = ... || jsonb_build_array(...)` with a `@>` containment guard (see `01-REVIEW.md` CR-01 fix sketch). This eliminates the race without changing the API contract.

## Verification Notes

- Implementation files were NOT modified (read-only audit). Only this SECURITY.md was written.
- Test suite re-run during audit: `npx vitest run src/lib/onboarding-progress.test.ts` → **20 passed (20)**.
- Live-DB RLS state (table present, RLS enabled, 4 owner-only policies, no `rls_disabled_in_public` advisory) was confirmed via Supabase MCP this session per the audit brief and corroborated by `01-01-SUMMARY.md` lines 74-82.
- Out-of-scope-for-this-register review findings (WR-01 unbounded `completed_steps` growth, WR-02 client-forgeable `completed_at`, WR-03 GET/PATCH shape mismatch, WR-04 `.single()` on concurrent delete) are documented in `01-REVIEW.md`. They are NOT in the plan-time threat register and are not blockers for this phase; flagged here only for traceability. WR-02 (client-supplied `completed_at`) is the most security-relevant and is recommended for a follow-up hardening task if `completed_at` ever feeds an authoritative/audited timeline.
