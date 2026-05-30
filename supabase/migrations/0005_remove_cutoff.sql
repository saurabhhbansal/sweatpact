-- Remove the per-user cutoff setting. Day boundaries are now determined purely
-- by timezone midnight. The cron enforces yesterday for every user each run.

alter table public.profiles
  drop column if exists cutoff_local_time;
