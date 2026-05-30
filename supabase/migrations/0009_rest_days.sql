-- Per-user scheduled weekly rest days (0=Sun, 1=Mon, …, 6=Sat).
-- These days are auto-excused by the enforcement job (gym_closed status)
-- and no longer need a manual "Gym closed" button.
alter table public.profiles
  add column if not exists rest_days integer[] not null default '{}';
