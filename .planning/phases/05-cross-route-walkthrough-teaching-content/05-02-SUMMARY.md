---
phase: 05-cross-route-walkthrough-teaching-content
plan: 02
subsystem: ui
tags: [onboarding, tour, coachmark, data-tour, cross-route, react, typescript]

# Dependency graph
requires:
  - phase: 04-tour-shell-and-coachmark
    provides: data-tour anchor convention + MutationObserver anchor-gate in CoachmarkRenderer
  - phase: 05-cross-route-walkthrough-teaching-content (Plan 01)
    provides: OnboardingStep.route field and STEPS routes that point each step at the tab carrying its anchor
provides:
  - "data-tour=\"challenge\" anchor on /groups new-challenge search section (self-starter path)"
  - "data-tour=\"money\" anchor on the always-mounted /groups <main> wrapper"
  - "data-pending-count={pendingCount} attribute on /groups <main> — invited-path detection without a fetch (D-09)"
  - "data-tour=\"challenge\" conditional anchor on the first pending invite <li> on /notifications (invited variant, D-10/ONB-03)"
  - "data-tour=\"shortcut_viewed\" anchor on the always-mounted ShortcutSetup wrapper on /shortcut"
affects: [coachmark-renderer (Plan 04), cross-route navigate-then-reveal, invited-path route swap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-attribute state bridge: server-rendered pendingCount exposed as data-pending-count so the client renderer reads invited-path state with zero latency and no extra fetch"
    - "Conditional JSX attribute spread: {...(cond ? { \"data-tour\": \"challenge\" } : {})} anchors only the first pending invite without a wrapper or per-item flag"

key-files:
  created: []
  modified:
    - src/app/(tabs)/groups/page.tsx
    - src/app/(tabs)/notifications/client.tsx
    - src/app/(tabs)/shortcut/page.tsx

key-decisions:
  - "money anchored to the always-mounted <main> (not ChallengeVersusCard standing, which is absent when there are no challenges) so the coachmark always has a target; teaching copy carries the lesson (specifics line 141)"
  - "challenge anchored to the unconditionally-mounted new-challenge search <section>, never the conditional empty-state card — the anchor must never live in a state-dependent slot"
  - "pending-count surfaced as a DOM attribute (D-09 zero-latency option) rather than a client fetch"
  - "invited anchor gated on index === 0 && isInvite via attribute spread — only the first pending challenge invite carries it; subsequent and non-invite cards do not"

patterns-established:
  - "Anchor placement rule: data-tour attributes go on unconditionally-mounted elements only; conditional cards are never anchor hosts"

metrics:
  duration: 3min
  completed: 2026-06-18
  tasks: 3
  files: 3

status: complete
---

# Phase 5 Plan 02: Cross-Route data-tour Anchors & Pending-Count Signal Summary

Added the cross-route `data-tour` anchors the walkthrough navigates to (`challenge`/`money` on `/groups`, invited-variant `challenge` on `/notifications`, `shortcut_viewed` on `/shortcut`) and exposed the live pending-invite count as a `data-pending-count` DOM attribute for invited-path detection — the DOM-attribute half of TOUR-05 that lets the Plan 04 renderer's dual-gate (pathname match + anchor present) and invited-path route swap function.

## What Was Built

- **`/groups` (Task 1):** `data-tour="money"` and `data-pending-count={pendingCount}` on the always-mounted `<main>`; `data-tour="challenge"` on the unconditionally-mounted new-challenge search `<section>`. The conditional empty-state card was deliberately left un-anchored. No data fetch, `pendingCount` derivation, `activeMemberships` filter, or `standingByGroup` logic was touched.
- **`/notifications` (Task 2):** `data-tour="challenge"` spread conditionally onto the invite `<li>`, gated on `index === 0 && isInvite`, so only the first pending challenge invite carries it (invited variant, D-10). The `respond()` accept/decline flow remains byte-identical.
- **`/shortcut` (Task 3):** `data-tour="shortcut_viewed"` on the always-mounted `ShortcutSetup` wrapper `<div>`. The id matches `STEPS[].id` exactly; no `ShortcutSurface` was added to the page (the surface lives in the coachmark card per Plan 04), and the webhook-secret fetch is unchanged.

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched the documented line numbers and element structure; anchors were added as additive attributes only.

## Verification

- `npx tsc --noEmit -p tsconfig.json` — passes after each task (all three route files typecheck with the new attributes).
- `grep -n 'data-tour="challenge"\|data-tour="money"\|data-pending-count' src/app/(tabs)/groups/page.tsx` → money (line 142), data-pending-count (line 143), challenge (line 221).
- `grep -n 'data-tour' src/app/(tabs)/notifications/client.tsx` → single conditional spread (line 238) gated `index === 0 && isInvite`.
- `grep -n 'data-tour="shortcut_viewed"' src/app/(tabs)/shortcut/page.tsx` → single anchor (line 32).
- `grep -c 'respond'` on notifications/client.tsx unchanged (8) — accept/decline flow untouched.
- No file deletions across the three commits.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. T-05-02-02 mitigation honored: the edit adds only a `data-tour` attribute and `respond()` (notifications/client.tsx) is byte-identical, so the financial-relevant accept path gains no new entry point. T-05-02-03 mitigation honored: anchor ids (`shortcut_viewed`, `challenge`, `money`) equal `STEPS[].id`. T-05-02-01 (info disclosure via `data-pending-count`) accepted as planned — the integer is already rendered on the page and RLS still scopes which invites the owner sees.

## Known Stubs

None. All anchors are wired to real, unconditionally-mounted page elements; `data-pending-count` carries the live derived `pendingCount`.

## Commits

- `7fad39b`: feat(05-02): add challenge + money anchors and data-pending-count to /groups
- `e135be9`: feat(05-02): add invited-variant challenge anchor to first pending invite
- `b944f31`: feat(05-02): add shortcut_viewed anchor to /shortcut

## Self-Check: PASSED
- FOUND: src/app/(tabs)/groups/page.tsx (anchors present)
- FOUND: src/app/(tabs)/notifications/client.tsx (conditional anchor present)
- FOUND: src/app/(tabs)/shortcut/page.tsx (anchor present)
- FOUND commit: 7fad39b
- FOUND commit: e135be9
- FOUND commit: b944f31
