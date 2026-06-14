-- Profile-column privacy lockdown.
-- Previously anon/authenticated had a blanket table-level SELECT on profiles,
-- and the RLS row policy is `using (true)`, so any logged-in user could
-- enumerate every column of every row over PostgREST — including each user's
-- email and home/gym coordinates and period-sync state.
--
-- Replace the table-level SELECT with column-level SELECT on the non-sensitive
-- columns only. Sensitive own-profile reads now go through the service-role
-- admin client (scoped to auth.uid()) in the app.
--
-- Locked (service-role only): email, gym_lat, gym_lng, gym_radius_m,
--   period_sync_enabled, period_last_synced_at.
-- gender stays readable — it drives the period-sharing UI on public profiles.
--
-- NOTE: with column-level grants, columns added to profiles in future
-- migrations are NOT auto-readable. Grant SELECT on each new non-sensitive
-- column explicitly.
-- (Applied to the live DB via the Supabase migration tool; this file keeps
-- repo history in sync.)

revoke select on public.profiles from anon, authenticated;

grant select (
  id, name, username, timezone, gender, weekly_goal, rest_days,
  profile_visibility, avatar_url, onboarding_complete, created_at, updated_at,
  notify_unverified_checkin, notify_rest_day, notify_cycle_share
) on public.profiles to anon, authenticated;
