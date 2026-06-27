---
phase: 08-event-instrumentation
plan: "03"
subsystem: analytics
tags: [posthog, server-side, analytics, pact-lifecycle, typescript]
dependency_graph:
  requires: [src/lib/analytics/server.ts, src/lib/analytics/events.ts]
  provides:
    - PACT_CREATED instrumentation (groups/create)
    - PACT_INVITE_ACCEPTED via invite_code (groups/join)
    - PACT_INVITE_ACCEPTED via invitation (challenges/respond accept branch)
    - PACT_INVITE_DECLINED (challenges/respond decline branch)
    - PACT_MEMBER_LEFT non-owner path (groups/leave)
  affects: []
tech_stack:
  added: []
  patterns: [captureServerEvent after DB success, event omitted on all error return paths, method property distinguishes invite-code vs invitation accept paths]
key_files:
  created: []
  modified:
    - src/app/api/groups/create/route.ts
    - src/app/api/groups/join/route.ts
    - src/app/api/challenges/respond/route.ts
    - src/app/api/groups/leave/route.ts
decisions:
  - "PACT_CREATED fires after both groups insert and group_members (owner) insert succeed — only on the happy path"
  - "PACT_INVITE_ACCEPTED carries method property (invite_code vs invitation) to distinguish the two acceptance paths in PostHog"
  - "PACT_INVITE_DECLINED fires after invitation status is updated to declined and push notification is sent — using invitation.group_id ?? null since new invitations have no group_id at decline time"
  - "PACT_MEMBER_LEFT fires only on the non-owner leave path (deleted_group: false) — owner-deletes-group path is group dissolution, not a member-left event"
  - "No event is wrapped in additional try/catch — the captureServerEvent helper already swallows all errors"
metrics:
  duration: 12m
  completed: 2026-06-27
  tasks_completed: 2
  files_created: 0
  files_modified: 4
status: complete
---

# Phase 08 Plan 03: Pact Lifecycle Instrumentation Summary

## One-Liner

Five pact lifecycle events (PACT_CREATED, PACT_INVITE_ACCEPTED x2, PACT_INVITE_DECLINED, PACT_MEMBER_LEFT) wired into four API routes at their respective post-DB-success points.

## What Was Built

### `src/app/api/groups/create/route.ts`

Added `captureServerEvent(auth.user.id, EVENT.PACT_CREATED, { group_id: group.id })` immediately after the `memberError` null-check and before the final `return NextResponse.json({ ok: true, group })`. Both the groups insert and the group_members (owner) insert must have succeeded before this line is reached — satisfying T-08-03-01.

### `src/app/api/groups/join/route.ts`

Added `captureServerEvent(auth.user.id, EVENT.PACT_INVITE_ACCEPTED, { group_id: group.id, method: "invite_code" })` after the `memberError` null-check and before the final return. The `method: "invite_code"` property distinguishes this path from the invitation-based accept in challenges/respond.

### `src/app/api/challenges/respond/route.ts`

Two call sites added:

**Decline branch:** `captureServerEvent(auth.user.id, EVENT.PACT_INVITE_DECLINED, { invitation_id, group_id: invitation.group_id ?? null })` inserted immediately before `return NextResponse.json({ ok: true, action: "declined" })`. The `group_id ?? null` handles new invitations (no group yet) and legacy invitations (group already exists). The event fires after the invitation status has been updated to "declined" in the DB and after the push notification is sent.

**Accept branch:** `captureServerEvent(auth.user.id, EVENT.PACT_INVITE_ACCEPTED, { group_id: groupId, method: "invitation" })` inserted after the recipient's `memberError` null-check and before the backfill loop (`for (const userId of backfillUsers)`). All `releaseAndFail()` early-return paths exit before this line — satisfying T-08-03-02.

### `src/app/api/groups/leave/route.ts`

Added `captureServerEvent(auth.user.id, EVENT.PACT_MEMBER_LEFT, { group_id: groupId, role: membership.role })` after the delete error check and before `return NextResponse.json({ ok: true, deleted_group: false })`. The owner-deletes-group path (`deleted_group: true`) returns earlier and receives no event — intentional, as that is a group dissolution rather than a member departure.

## Deviations from Plan

None — plan executed exactly as written. All five events fire at the specified post-DB-success points. No event fires on any error return path.

## Verification Results

- `npx tsc --noEmit` exits 0 — no TypeScript errors
- `npm test` exits 0 — all 162 tests pass (13 test files)
- groups/create/route.ts: captureServerEvent(PACT_CREATED) present after memberError check
- groups/join/route.ts: captureServerEvent(PACT_INVITE_ACCEPTED, method:"invite_code") present after memberError check
- challenges/respond/route.ts: PACT_INVITE_DECLINED before declined return; PACT_INVITE_ACCEPTED (method:"invitation") before backfill loop
- groups/leave/route.ts: PACT_MEMBER_LEFT only on non-owner path

## Known Stubs

None — all five event call sites are fully wired with real properties from the live DB operations.

## Threat Flags

None — the four routes emit only Supabase UUIDs (group_id, invitation_id) and enum values (role, method). No PII crosses the analytics boundary. New instrumentation does not add network endpoints or auth paths beyond the plan's threat model.

## Self-Check

- [x] `src/app/api/groups/create/route.ts` contains `captureServerEvent` and `EVENT.PACT_CREATED`
- [x] `src/app/api/groups/join/route.ts` contains `captureServerEvent` and `EVENT.PACT_INVITE_ACCEPTED` with `method: "invite_code"`
- [x] `src/app/api/challenges/respond/route.ts` contains both PACT_INVITE_DECLINED (decline branch) and PACT_INVITE_ACCEPTED (accept branch, method: "invitation")
- [x] `src/app/api/groups/leave/route.ts` contains `EVENT.PACT_MEMBER_LEFT` on non-owner path only
- [x] Task 1 commit 5403a87 exists in git log
- [x] Task 2 commit bd5b494 exists in git log
- [x] TypeScript strict mode satisfied (tsc --noEmit exits 0)
- [x] All 162 tests pass

## Self-Check: PASSED
