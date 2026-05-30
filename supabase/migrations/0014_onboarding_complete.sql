alter table public.profiles
  add column if not exists onboarding_complete boolean not null default false;

-- Existing users with real (non-auto-generated) usernames are considered complete
-- so they don't get forced through the new wizard.
update public.profiles
  set onboarding_complete = true
  where username is not null
    and username !~ '^user_[a-f0-9]{8}$';
