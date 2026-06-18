---
status: testing
phase: 05-cross-route-walkthrough-teaching-content
source: [05-VERIFICATION.md]
started: 2026-06-18T19:30:00Z
updated: 2026-06-18T19:30:00Z
---

## Current Test

number: 1
name: Navigate-Then-Reveal Cross-Route Sequencing (TOUR-05)
expected: |
  Coachmarks never appear over empty/transitioning space. Each step reveals only after the new page's anchor element is mounted. The tour completes all 5 steps across at least 3 different routes.
awaiting: user response

## Tests

### 1. Navigate-Then-Reveal Cross-Route Sequencing (TOUR-05)

expected: Start the dev server (`npm run dev`). Sign in as a user whose tour is active. Advance through all 5 steps: schedule → gym → challenge → money → shortcut. Each advance should navigate to the step's route (if different from current) and only reveal the coachmark once that route's `data-tour` anchor appears in the DOM. Coachmarks never appear over empty/transitioning space.
result: [pending]

### 2. Invited-Path Route Swap (ONB-03)

expected: Sign in as a user with a pending challenge invite (pendingCount > 0 on /groups). Run the tour to the challenge step. Challenge step routes to `/notifications` and shows "Your partner challenged you" copy. The anchor is on the first pending invite card.
result: [pending]

### 3. Practice Check-In Financial Safety (TEACH-05) — HIGHEST PRIORITY

expected: Open browser DevTools → Network tab, filter to "checkin". Navigate tour to shortcut step. Click "Practice check-in". Confirm ZERO requests to `/api/checkin` are issued. Tour advances. Dashboard check-in state unchanged — no real check-in created.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
