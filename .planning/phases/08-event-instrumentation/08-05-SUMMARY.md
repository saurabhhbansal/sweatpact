---
phase: 08-event-instrumentation
plan: "05"
subsystem: analytics
tags: [posthog, client-events, feature-usage, nav, notifications, shortcut]
dependency_graph:
  requires: [08-01]
  provides: [INSTR-05]
  affects: [src/components/nav.tsx, src/components/notifications-overlay.tsx, src/app/(tabs)/shortcut/client.tsx]
tech_stack:
  added: []
  patterns: [usePostHog hook, event delegation, mount useEffect]
key_files:
  modified:
    - src/components/nav.tsx
    - src/components/notifications-overlay.tsx
    - src/app/(tabs)/shortcut/client.tsx
decisions:
  - Event delegation used on the notification section to capture any click within the list without modifying child components
  - Optional chaining (posthog?.capture) on all call sites — required per research pitfall 3; usePostHog() returns undefined outside PostHogProvider or during SSR hydration
  - Cycle tab Link intentionally excluded from FEATURE_TAB_VISITED — it is outside the links.map() loop per plan spec
metrics:
  duration: "~2 minutes"
  completed: "2026-06-27"
  tasks: 2
  files: 3
status: complete
---

# Phase 08 Plan 05: Client-Side Feature-Usage Events Summary

**One-liner:** Three client-side feature-usage events wired via usePostHog() — tab navigation, notification engagement, and shortcut page discovery using EVENT.* typed constants throughout.

## What Was Built

Wire three client-side feature-usage events using the `usePostHog()` hook from `posthog-js/react`. All three components are `"use client"` descendants of the `PostHogProvider` in the root layout. No server helper needed.

### Task 1: FEATURE_TAB_VISITED in nav.tsx

- Added `usePostHog` from `posthog-js/react` and `EVENT` from `@/lib/analytics/events` imports
- Called `usePostHog()` inside `MobileNav` after `prevIndexRef` declaration
- Added `onClick` to each tab `Link` in `links.map()`: `posthog?.capture(EVENT.FEATURE_TAB_VISITED, { tab: link.label.toLowerCase() })`
- Fires on active user clicks only (not programmatic navigation); produces "dashboard", "challenges", or "profile"
- Commit: `2b8d871`

### Task 2: FEATURE_NOTIFICATION_CLICKED and FEATURE_SHORTCUT_SETUP_VIEWED

**notifications-overlay.tsx:**
- Added `usePostHog` and `EVENT` imports
- Added `const posthog = usePostHog()` after existing state declarations
- Added `onClick={() => posthog?.capture(EVENT.FEATURE_NOTIFICATION_CLICKED)}` to the `section` wrapping `NotificationsList` — event delegation captures all clicks within the notification list

**shortcut/client.tsx:**
- Added `useEffect` to existing React imports (`useState, useTransition, useEffect`)
- Added `usePostHog` and `EVENT` imports
- Added `const posthog = usePostHog()` inside `ShortcutSetup`
- Added mount-only `useEffect` with empty dependency array: fires `EVENT.FEATURE_SHORTCUT_SETUP_VIEWED` exactly once when user lands on the shortcut setup page
- Commit: `384ed75`

## Verification

- TypeScript: `npx tsc --noEmit` exits 0 (no errors)
- Tests: 162/162 passed (all 13 test files)
- All posthog calls use optional chaining (`posthog?.capture`)
- All event names reference `EVENT.*` constants — no inline event-name strings
- Cycle tab Link not modified (outside `links.map()` scope per plan)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new trust boundaries introduced. All events are feature-usage signals only (not used for financial calculations or authorization). Threat dispositions per plan threat model:

| Threat | Component | Disposition |
|--------|-----------|-------------|
| T-08-05-01 | Client-side events are user-controlled | accept |
| T-08-05-02 | Tab label in FEATURE_TAB_VISITED properties | accept |
| T-08-05-03 | FEATURE_SHORTCUT_SETUP_VIEWED fires on mount | accept |

No new threat surface beyond what was modeled.

## Self-Check: PASSED

Files exist:
- src/components/nav.tsx — FOUND (contains FEATURE_TAB_VISITED, usePostHog)
- src/components/notifications-overlay.tsx — FOUND (contains FEATURE_NOTIFICATION_CLICKED, usePostHog)
- src/app/(tabs)/shortcut/client.tsx — FOUND (contains FEATURE_SHORTCUT_SETUP_VIEWED, usePostHog, useEffect)

Commits exist:
- 2b8d871 — FOUND
- 384ed75 — FOUND
