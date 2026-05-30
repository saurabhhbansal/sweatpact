-- Notification preferences.
--
-- Per-group toggle: notify the other members when someone checks in. Default on.
alter table public.groups
  add column if not exists checkin_notifications boolean not null default true;

-- Per-user toggles: broadcast my unverified check-ins / rest days to the other
-- members of my challenges. Default on for everyone.
alter table public.profiles
  add column if not exists notify_unverified_checkin boolean not null default true,
  add column if not exists notify_rest_day boolean not null default true;
