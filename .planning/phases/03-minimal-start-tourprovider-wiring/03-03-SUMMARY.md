---
phase: 03-minimal-start-tourprovider-wiring
plan: 03
subsystem: onboarding-gate
status: complete
tags: [gate-cleanup, redirect, onboarding, tabs]
dependency_graph:
  requires: [03-02]
  provides: [gate-centralization-complete, ONB-02-satisfied]
  affects: [src/app/(tabs)]
tech_stack:
  added: []
  patterns: [layout-gate-single-source-of-truth, auth-guard-preserved]
key_files:
  created: []
  modified:
    - src/app/(tabs)/dashboard/page.tsx
    - src/app/(tabs)/groups/page.tsx
    - src/app/(tabs)/groups/[id]/page.tsx
    - src/app/(tabs)/cycle/page.tsx
    - src/app/(tabs)/notifications/page.tsx
    - src/app/(tabs)/settings/page.tsx
    - src/app/(tabs)/u/me/page.tsx
    - src/app/(tabs)/u/[username]/page.tsx
decisions:
  - "D-03 enforced: layout gate (plan 03-02) is the single source of truth for username redirect; all per-page username + onboarding_complete redirects removed"
  - "Functional non-onboarding redirects preserved: cycle gender gate, u/me final redirect, groups/[id] membership redirect"
  - "Auth guard (if (!profile) redirect('/login')) preserved on all 8 pages to maintain TypeScript strict null narrowing"
metrics:
  duration: 2min
  completed: 2026-06-17
  tasks_completed: 3
  files_changed: 8
---

# Phase 03 Plan 03: Gate Cleanup — Per-Page Redirect Removal Summary

**One-liner:** Deleted username + onboarding_complete per-page redirects from all 8 (tabs) pages while surgically preserving auth guards, the cycle gender gate, u/me final redirect, and groups/[id] membership redirect.

## What Was Built

Removed the now-redundant `if (!profile.username || /^user_[a-f0-9]{8}$/.test(...)) redirect("/onboarding/username")` and `if (!profile.onboarding_complete) redirect("/onboarding/schedule")` blocks from all 8 `(tabs)` pages. The layout gate installed in plan 03-02 is now the single source of truth (D-03). Users with incomplete optional setup land directly in the real app.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Remove onboarding redirects from dashboard, groups, groups/[id], cycle | a322e27 | 4 pages |
| 2 | Remove onboarding redirects from notifications, settings, u/me, u/[username] | 8eb8db4 | 4 pages |
| 3 | Verify full gate cleanup across all 8 pages (grep + tsc + npm test) | d38bfd9 | verification only |

## Verification Results

- `grep onboarding_complete` across 8 (tabs) pages: **0 matches**
- `grep redirect("/onboarding/schedule")` across 8 pages: **0 matches**
- `grep redirect("/onboarding/username")` across 8 pages: **0 matches**
- Preserved `!profile → /login` on: dashboard, groups, groups/[id], cycle, notifications, settings, u/me
- Preserved `!viewerProfile → /login` on: u/[username]
- Preserved `cycle/page.tsx` gender gate: `if (profile.gender !== "female") redirect("/dashboard")`
- Preserved `u/me/page.tsx` final redirect: `redirect(\`/u/${profile.username}\`)`
- Preserved `groups/[id]/page.tsx` membership redirect: `redirect("/groups")`
- `npx tsc --noEmit`: **PASSED**
- `npm test`: **123/123 tests green**

## Deviations from Plan

None — plan executed exactly as written. All deletions were mechanical line removal matching the PATTERNS.md deletion table. Preservations (Pitfalls 3 and 4) confirmed intact via grep and TypeScript strict null checks.

## Known Stubs

None. This plan performs line deletions only; no new UI or data stubs were introduced.

## Threat Flags

None. This plan removes redirect lines and introduces no new network endpoints, auth paths, or schema changes. The T-03-GATEBYPASS threat (gate bypass from per-page redirect removal before layout gate exists) is fully mitigated: plan 03-02 (the layout gate) was sequenced before this plan (wave 3, depends_on 03-02). The `!profile → /login` auth guard is preserved on every page, so TypeScript strict-null safety is maintained.

## Self-Check: PASSED

- dashboard/page.tsx: found, modified
- groups/page.tsx: found, modified
- groups/[id]/page.tsx: found, modified
- cycle/page.tsx: found, modified
- notifications/page.tsx: found, modified
- settings/page.tsx: found, modified
- u/me/page.tsx: found, modified
- u/[username]/page.tsx: found, modified
- Commits a322e27, 8eb8db4, d38bfd9: verified in git log
