-- Force any existing mixed-case usernames to lowercase. The unique index is on
-- lower(username) already, so this won't introduce collisions.
update public.profiles
  set username = lower(username)
  where username is not null
    and username <> lower(username);

-- Tighten the format check to lowercase-only going forward.
alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');
