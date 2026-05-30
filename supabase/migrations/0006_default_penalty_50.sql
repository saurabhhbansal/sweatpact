-- Raise default group penalty from ₹5 (500 paise) to ₹50 (5000 paise).
-- Existing groups are unaffected; only new group creation uses this default.

alter table public.groups
  alter column default_penalty_cents set default 5000;
