-- Add per-relationship opt-in for "period approaching" notifications.
-- The grantee (shared_with_id) flips this for each person who shares with them.
-- Default false so no one receives reminders without explicitly opting in.
ALTER TABLE public.period_sharing
  ADD COLUMN IF NOT EXISTS notify_approaching boolean NOT NULL DEFAULT false;
