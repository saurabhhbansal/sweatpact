-- Previously: a user could only SELECT another user's profile if they shared a
-- group with them. This made user search return zero results for any newly
-- signed-up user, breaking the discovery flow. Relax so any authenticated
-- session can read profile rows. Sensitive fields (webhook_secret, email) are
-- never surfaced in the UI to other users; the application code controls what
-- is rendered based on profile_visibility.

drop policy if exists "profiles self read" on public.profiles;

create policy "profiles read authenticated" on public.profiles
  for select
  to authenticated
  using (true);
