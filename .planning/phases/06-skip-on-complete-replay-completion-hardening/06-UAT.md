---
status: partial
phase: 06-skip-on-complete-replay-completion-hardening
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md]
started: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:05:00Z
---

## Current Test

[testing paused — 10 items skipped by user]

## Tests

### 1. Tour auto-skips already-done setup steps
expected: With gym and schedule already configured (i.e., you have a gym saved and rest days set), open the app and trigger the tour. The tour should open directly on the first not-yet-done step (e.g., "Challenge" or "Shortcut" — whatever comes after the completed steps). It must NOT flash or briefly show the Gym or Schedule steps before jumping forward. The first visible coachmark should be for the first incomplete step.
result: skipped

### 2. Tour opens on correct step for fresh user
expected: With no gym saved and no schedule set, trigger the tour. It should open on the very first setup step (Gym). No steps are skipped. The coachmark points at the gym setup element.
result: skipped

### 3. Replay app tour button in Settings
expected: Navigate to Settings. In the setup region (after "iOS Shortcuts"), there should be a quiet ghost glass-card row with a "Replay app tour" label, a subtitle "Walk through the app again", and a circular-arrow (RotateCcw) icon. It should NOT be a white accent button — it should look like a subtle secondary row.
result: skipped

### 4. Replay reactivates tour without resetting progress
expected: Tap "Replay app tour" in Settings. The button shows a loading/disabled state while the PATCH fires. After the refresh, the tour reactivates. If setup steps (gym, schedule) are already done, the tour opens on the first incomplete step (auto-skip is preserved). completed_steps are NOT wiped — you're not forced to redo what's already done.
result: skipped

### 5. Replay button error state
expected: With network unavailable (or simulated failure), tap "Replay app tour". The button should show an inline error message: "Couldn't restart the tour. Try again." The button re-enables after the error. No crash or silent failure.
result: skipped

### 6. Pact-is-Live overlay appears on first active challenge
expected: Navigate to the Groups tab when you have an active challenge AND have never seen the pact-live overlay before (pact_live_seen not in completed_steps). A full-screen dark overlay appears: headline "Your pact is live.", body "Real money's on the line now. Show up — or pay up.", a lock icon, and a single white "Let's go →" button at the bottom. There is NO corner X close button. The overlay covers the entire screen (z-[120] takeover).
result: skipped

### 7. Pact-is-Live overlay dismisses and never reappears
expected: Tap "Let's go →" on the overlay. It dismisses and you see the Groups page. Navigate away and back to Groups — the overlay does NOT reappear. Even after a page reload or on a different device (same account), the overlay stays dismissed permanently.
result: skipped

### 8. Pact-is-Live overlay suppressed without active challenge
expected: Navigate to Groups when you have NO active challenge (no accepted/active membership). The "Your pact is live." overlay should NOT appear. The page loads normally with no overlay.
result: skipped

### 9. Legacy wizard pages are gone
expected: Navigate directly to /onboarding/gym, /onboarding/schedule, or /onboarding/shortcut in the browser. Each should return a 404 or redirect — none of them should render a wizard step. These pages no longer exist.
result: skipped

### 10. Username onboarding redirects to dashboard after save
expected: If you somehow reach /onboarding/username (e.g., with an auto-generated username), enter a valid username and save. After saving, you should be redirected to /dashboard — NOT to /onboarding/schedule or any other wizard page. The step indicator that used to show above the username form is also gone.
result: skipped

## Summary

total: 10
passed: 0
issues: 0
pending: 0
skipped: 10
blocked: 0

## Gaps

[none]
