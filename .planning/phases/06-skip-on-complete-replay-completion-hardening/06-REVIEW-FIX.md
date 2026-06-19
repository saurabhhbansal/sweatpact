---
phase: "06"
status: all_fixed
findings_in_scope: 4
fixed: 4
skipped: 0
iteration: 1
---

# Code Review Fix Report: Phase 06

## Summary

All 4 Critical and Warning findings from 06-REVIEW.md were fixed across 3 commits. Info findings (IN-001, IN-002) were out of scope and left as-is.

## Fixes Applied

### CR-001: ReplayTourButton permanently locks busy state on network error
**Status:** Fixed  
**Commit:** fix(06): guard ReplayTourButton busy state and cancel ChangePasswordButton close timer  
**Change:** Wrapped `fetch` in try/catch/finally so `setBusy(false)` always runs — network errors now set the error message instead of freezing the button.

### WR-001: ChangePasswordButton timer not cancelled on unmount
**Status:** Fixed  
**Commit:** fix(06): guard ReplayTourButton busy state and cancel ChangePasswordButton close timer  
**Change:** Added `closeTimerRef` (useRef) to store the timer ID, `useEffect` cleanup to cancel it on unmount, and replaced `window.setTimeout` with `setTimeout`.

### WR-002: PactLiveOverlay can re-open after dismiss when parent re-renders
**Status:** Fixed  
**Commit:** fix(06): prevent PactLiveOverlay re-open after dismiss on parent re-render  
**Change:** Added `seenLocally` boolean state; dismiss() sets it immediately, gating both the useEffect (skips re-evaluation) and the early-return guard (returns null) before the server round-trip completes.

### WR-003: user_gyms Supabase error silently swallowed
**Status:** Fixed  
**Commit:** fix(06): log user_gyms DB error so gym-skip failure is visible  
**Change:** Destructured `error` from the `user_gyms` query and logs it via `console.error`; `gymCount=0` graceful fallback retained.

## Skipped

None — all in-scope findings were fixed.

## Out of Scope (Info)

- **IN-001**: `isAutoUsername` duplication across two files — deferred, requires creating a new shared module.
- **IN-002**: Missing test for `replay: true` + `dismissed: true` combination — deferred, test-only addition outside this fix pass.
