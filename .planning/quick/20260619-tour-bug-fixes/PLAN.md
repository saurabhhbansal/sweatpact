---
slug: tour-bug-fixes
date: 2026-06-19
status: in-progress
---

# Tour Bug Fixes

Fix four bugs in the onboarding tour system.

## Tasks

1. **Arrow + card off-viewport** — `src/components/tour/coachmark-renderer.tsx`
   - Add `floaterProps={{ hideArrow: true }}` to Joyride to hide its built-in arrow
   - Remove safe-area padding wrapper from `TooltipAdapter` (inflates tooltip size for Joyride's position calc → card goes off-screen)

2. **Replay button does nothing** — `src/lib/onboarding-progress.ts`
   - In `mergeProgress`, when `replay: true`, reset `completed_steps = []` and `last_step_id = null`
   - Teaching-only steps (challenge/money/shortcut_viewed) have no real-world probe; if they're in completed_steps they get skipped → tour returns null → button appears broken

3. **Gym step doesn't auto-advance after adding gym** — `src/components/onboarding/gym-surface.tsx`
   - Call `onComplete()` after `pick()` and `useCurrentLocation()` succeed
   - Currently shows "gym added" confirmation but leaves the tour on gym step requiring manual "Continue" click

4. **Past signed-up users see tour** — `supabase/migrations/0031_fix_existing_user_tour.sql`
   - Migration 0030 backfilled `onboarding_progress` rows for existing users but only set `dismissed=true` for those with `onboarding_complete=true`
   - Users who signed up between migration 0014 and 0030 have `dismissed=false, completed_steps=[]` but already have gym set
   - New migration: set `dismissed=true` for all rows with `dismissed=false, completed_steps='[]', EXISTS user_gym`

## Files

- `src/components/tour/coachmark-renderer.tsx`
- `src/lib/onboarding-progress.ts`
- `src/lib/onboarding-progress.test.ts` (update mergeProgress replay tests)
- `src/components/onboarding/gym-surface.tsx`
- `supabase/migrations/0031_fix_existing_user_tour.sql` (new)
