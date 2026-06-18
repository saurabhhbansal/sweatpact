---
status: complete
phase: 02-step-logic-shared-setup-surfaces
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
started: 2026-06-15T16:05:43Z
updated: 2026-06-15T17:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Schedule Route — Parity
expected: Visit /onboarding/schedule as a user who hasn't completed onboarding. You should see a weekly goal picker (gap-1.5 chip clusters), rest-day toggles (circular h-9 w-9 buttons), helper text updating as toggles change ("{n} rest days · {7-n} gym days available"), over-budget error in white styling ("Rest days + goal can't exceed 7."), solid-white Continue button, opacity-ramp Skip link. Continue → /onboarding/gym. Skip → /onboarding/gym.
result: pass

### 2. Gym Route — Parity
expected: Visit /onboarding/gym. Type ≥2 chars in the search field ("Search for your gym or address…"). After ~250ms debounce, results list appears. Add a gym (or "Use my current location") → status card shows "{count} gym added." Solid-white Continue button. Continue → /onboarding/shortcut.
result: pass

### 3. Shortcut Route — Parity
expected: Visit /onboarding/shortcut. CopyField showing User ID + Secret and install guide link/instructions visible. Solid-white "Done" button visible. Clicking Done → navigates to /dashboard.
result: pass

### 4. Write Verification After Shortcut Done
expected: After clicking Done on /onboarding/shortcut, check Supabase directly (or via app state). onboarding_progress.completed_steps for your user should contain "shortcut_viewed". profiles.onboarding_complete should be true.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
