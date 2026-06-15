---
phase: 02-step-logic-shared-setup-surfaces
fixed_at: 2026-06-15T00:00:00Z
review_path: .planning/phases/02-step-logic-shared-setup-surfaces/02-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-06-15T00:00:00Z
**Source review:** .planning/phases/02-step-logic-shared-setup-surfaces/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01 through WR-06; IN-01 and IN-02 excluded by fix_scope=critical_warning)
- Fixed: 5
- Skipped: 1

## Fixed Issues

### WR-01: ScheduleSurface.save leaves busy=true permanently on network failure

**Files modified:** `src/components/onboarding/schedule-surface.tsx`
**Commit:** 9198c26
**Applied fix:** Wrapped the `fetch("/api/profile", ...)` call inside `save()` with a `try/catch/finally` block. The `finally` always calls `setBusy(false)`, and the `catch` sets an error message "Network error. Please try again." so the user has a recoverable path. Moved the `!res.ok` check inside the try block.

---

### WR-02: ShortcutSurface.finish leaves busy=true permanently on network failure

**Files modified:** `src/components/onboarding/shortcut-surface.tsx`
**Commit:** 22be346
**Applied fix:** Wrapped the `fetch("/api/onboarding-progress", ...)` call inside `finish()` with a `try/catch/finally` block. The `finally` always calls `setBusy(false)`, and the `catch` swallows the error (best-effort semantics preserved). Moved `onComplete()` after the try/finally so it is always called regardless of network outcome.

---

### WR-03: GymSurface.useCurrentLocation success-callback fetch can throw without resetting busy

**Files modified:** `src/components/onboarding/gym-surface.tsx`
**Commit:** d85d102
**Applied fix:** Wrapped the entire `fetch("/api/gyms", ...)` body inside the geolocation success callback with a `try/catch/finally` block. `finally` calls `setBusy(false)` (moved from inside the body), `catch` sets a "Network error. Try again." message. This ensures busy state always resets whether the fetch succeeds, fails with a non-OK status, or throws.

---

### WR-04: GymSurface.pick proceeds with invalid details when /api/places/details returns non-OK

**Files modified:** `src/components/onboarding/gym-surface.tsx`
**Commit:** d85d102
**Applied fix:** Changed `const details = await detailsRes.json()` to `const details = detailsRes.ok ? await detailsRes.json() : {}`. When the details API returns a non-OK status, `details` is an empty object, so `details.lat` and `details.lng` are `undefined` rather than error payload fields, and the gyms API will reject the body with missing coordinates instead of silently creating an unverifiable gym.

---

### WR-05: GymSurface debounce effect leaves searching=true when query is cleared mid-flight

**Files modified:** `src/components/onboarding/gym-surface.tsx`
**Commit:** d85d102
**Applied fix:** Added `setSearching(false)` to the `q.length < 2` short-circuit branch in the `useEffect`. Previously, when the user typed 2+ characters (setting `searching=true`), then cleared the input before the 250ms debounce timer fired, `setSearching(false)` was never called because the cleanup function only ran `clearTimeout`. The "Searching..." spinner would persist indefinitely.

---

## Skipped Issues

### WR-06: isScheduleDone returns false for a valid "no rest days" configuration

**File:** `src/lib/onboarding/completion.ts:28-30`
**Reason:** Both proposed fixes require scope beyond a targeted source fix. The DB migration approach (`schedule_configured` boolean column) requires a Supabase schema migration and a new API field. The sentinel value approach (`-1` in the `rest_days` array) is blocked by the existing Zod validation in `src/app/api/profile/route.ts` which enforces `z.number().int().min(0).max(6)` on each element — `rest_days: [-1]` would fail validation at the API boundary. Implementing either fix correctly requires coordinating changes across the migration file, the profile API schema, `ScheduleSurface`, `isScheduleDone`, and `completion.test.ts`. This is a design-level decision with deliberate tradeoffs (acknowledged in the existing code comment) and is best resolved as a separate planned change rather than an atomic reviewer fix.

**Original issue:** `isScheduleDone` returns `false` for an empty `rest_days` array, which is both the initial state (correct: "not configured") and the desired state for a 7-day-a-week trainer (false-negative: "configured but indistinguishable from initial"). Users who deliberately choose zero rest days will always see the schedule onboarding step re-presented.

---

_Fixed: 2026-06-15T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
