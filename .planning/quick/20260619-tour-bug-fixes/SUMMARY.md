---
slug: tour-bug-fixes
date: 2026-06-19
status: complete
---

# Tour Bug Fixes — Summary

## What was done

Fixed four bugs in the onboarding tour system (commit 4a49369).

### 1. Arrow + card off-viewport (`coachmark-renderer.tsx`)
- Added `floaterProps={{ hideArrow: true }}` to suppress Joyride's built-in arrow indicator
- Removed safe-area padding wrapper from `TooltipAdapter` — it inflated the tooltip's measured size, causing Joyride's positioning algorithm to place the card outside the viewport

### 2. Replay button broken (`onboarding-progress.ts`)
- `mergeProgress` now clears `completed_steps = []` and resets `last_step_id = null` when `replay: true`
- Teaching-only steps (challenge/money/shortcut_viewed) have no real-world probe, so they only skip when present in `completed_steps`; without clearing, replay returned null (nothing to show)
- Setup steps (gym/schedule) auto-skip via probe if already done — clearing is safe

### 3. Gym step no auto-advance (`gym-surface.tsx`)
- `pick()` and `useCurrentLocation()` now call `onComplete()` immediately after a gym is successfully added
- Previously showed "gym added" confirmation but left the tour on the gym step requiring a manual Continue click

### 4. Past users seeing tour (`0031_fix_existing_user_tour.sql`)
- New migration sets `dismissed = true` for rows where `dismissed = false AND completed_steps = [] AND EXISTS user_gym`
- Migration 0030 backfilled `onboarding_progress` but only marked `dismissed = true` for users with `onboarding_complete = true`; users who signed up between migrations 0014 and 0030 had `dismissed = false` and saw the tour at the "challenge" step

## Tests

All 57 onboarding tests pass. Updated `mergeProgress` replay test to reflect the new cleared-steps behavior.

## Action required

Apply migration `supabase/migrations/0031_fix_existing_user_tour.sql` to production Supabase.
