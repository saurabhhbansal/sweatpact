-- Per-user preference: receive a notification when someone grants you access
-- to their cycle data. Defaults on; the recipient can opt out in Settings.
alter table public.profiles
  add column if not exists notify_cycle_share boolean not null default true;
