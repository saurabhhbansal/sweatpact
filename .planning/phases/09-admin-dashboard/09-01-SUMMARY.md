---
phase: 09-admin-dashboard
plan: 01
subsystem: auth
tags: [admin, security, owner-gate, ADMIN-01]
status: complete
requires:
  - "@/lib/supabase/server.createClient"
  - "next/navigation.notFound"
provides:
  - "@/lib/admin-auth.parseAdminUserIds"
  - "@/lib/admin-auth.requireOwner"
affects:
  - "src/app/admin/* (future) — every /admin surface gates via requireOwner()"
tech-stack:
  added: []
  patterns:
    - "fail-closed env allow-list (empty ADMIN_USER_IDS -> nobody is admin)"
    - "getUser() server-side session revalidation (never getSession)"
    - "notFound() deny path (404, not 403/redirect) to avoid route-existence disclosure"
    - "server-only library unit-testable via vitest alias stub"
key-files:
  created:
    - src/lib/admin-auth.ts
    - src/lib/admin-auth.test.ts
    - test/shims/server-only.ts
  modified:
    - vitest.config.ts
decisions:
  - "Stubbed `server-only` in vitest.config.ts so server-only library modules can be unit-tested (Next supplies it via build-time alias only)"
metrics:
  duration: 2min
  tasks: 2
  files: 4
  completed: 2026-06-28
---

# Phase 9 Plan 01: Admin Owner Gate Summary

Fail-closed owner gate (ADMIN-01) for `/admin`: `parseAdminUserIds()` turns the
comma-separated `ADMIN_USER_IDS` env var into a trimmed allow-list, and
`requireOwner()` revalidates the session with `getUser()` and calls Next.js
`notFound()` for every non-owner path — proven by 11 passing unit tests.

## What Was Built

- **`src/lib/admin-auth.ts`** (server-only):
  - `parseAdminUserIds(raw): string[]` — pure parser; splits on `,`, trims, drops
    empty segments. Missing/empty/whitespace input yields `[]` so the gate fails
    closed (no env read inside — `raw` is a parameter).
  - `requireOwner(): Promise<string>` — reads `ADMIN_USER_IDS`, 404s on an empty
    allow-list, builds the cookie-bound `createClient()`, revalidates via
    `getUser()`, and 404s on auth error / missing uid / non-listed uid. Returns
    the owner uid only when it is on the allow-list.
- **`src/lib/admin-auth.test.ts`** — 6 parser cases + 5 gate branches (empty
  list, getUser error, missing uid, non-listed uid, listed owner).

## How It Was Verified

- `npx vitest run src/lib/admin-auth.test.ts` → 11 passed.
- Full suite `npm run test` → 173 passed (14 files); the vitest alias change
  broke nothing.
- `npm run typecheck` → exit 0.
- Source checks: line 1 is exactly `import "server-only";`; contains `getUser`,
  contains no `getSession`; contains `notFound(`, contains no `redirect(`;
  imports `createClient` from `@/lib/supabase/server` (not `/admin`).

## Threat Model Coverage (mitigations applied)

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-09-01 Spoofing | `getUser()` server round-trip revalidation, never `getSession()` | done |
| T-09-02 Info Disclosure | `notFound()` (404) for all deny paths | done |
| T-09-03 Elevation (empty list) | `parseAdminUserIds` -> `[]` and `requireOwner` 404s on empty list | done |
| T-09-04 Server-only scope | `import "server-only"` at file top | done |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `server-only` unresolvable under vitest**
- **Found during:** Task 1 (RED run)
- **Issue:** The plan mandates `import "server-only";` at line 1 of `admin-auth.ts`
  and co-located tests importing from that file. Next.js supplies `server-only`
  via a build-time alias only — it is not an installed package — so vitest failed
  with `Cannot find package 'server-only'`, blocking every test in the file.
- **Fix:** Added an empty stub at `test/shims/server-only.ts` and aliased
  `server-only` -> that stub in `vitest.config.ts` (alongside the existing `@`
  alias). Test-infra only; no runtime/behavior change. Full suite (173 tests)
  confirms no regression.
- **Files modified:** `test/shims/server-only.ts` (new), `vitest.config.ts`
- **Commit:** efbf45c (introduced with the RED test)

**2. [Rule 1 - minor] Comment reworded to avoid `getSession` literal**
- **Found during:** Task 2 acceptance check
- **Issue:** A code comment described the rejected approach by name
  (`getSession()`), tripping the strict "source does NOT contain getSession"
  acceptance criterion.
- **Fix:** Reworded the comment to "the cookie-only session decoder" — same
  guidance, no forbidden token. Tests still green.
- **Files modified:** `src/lib/admin-auth.ts`
- **Commit:** 6f03d3b

## TDD Gate Compliance

Both tasks followed RED → GREEN. Gate commits present:
- Task 1: `test(09-01)` efbf45c (RED) → `feat(09-01)` 9729d4b (GREEN)
- Task 2: `test(09-01)` 738ccde (RED) → `feat(09-01)` 6f03d3b (GREEN)

No REFACTOR commits needed.

## Known Stubs

None. `test/shims/server-only.ts` is an intentional, permanent test double for a
Next-provided module — not an unfinished feature stub.

## Self-Check: PASSED

- FOUND: src/lib/admin-auth.ts
- FOUND: src/lib/admin-auth.test.ts
- FOUND: test/shims/server-only.ts
- FOUND commit: efbf45c, 9729d4b, 738ccde, 6f03d3b
