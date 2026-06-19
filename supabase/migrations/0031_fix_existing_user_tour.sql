-- Migration 0030 backfilled onboarding_progress rows for existing users but only
-- set dismissed=true for those with onboarding_complete=true. Users who signed up
-- between migration 0014 and 0030 have dismissed=false and completed_steps=[] even
-- though they already set up their gym and are using the app. This migration
-- corrects that by dismissing any row where the user already has a gym but has
-- never interacted with the tour (completed_steps still empty).
--
-- New users who are currently going through the tour will have non-empty
-- completed_steps by the time they add a gym (schedule step fires first), so this
-- update only affects pre-tour users.

update public.onboarding_progress op
set dismissed = true
where op.dismissed = false
  and op.completed_steps = '[]'::jsonb
  and exists (
    select 1 from public.user_gyms ug
    where ug.user_id = op.user_id
  );
