-- Make obligation creation idempotent: a given penalty owes a given recipient
-- exactly once. Without this, a doubled or raced enforcement run (the cron can
-- also be triggered manually) inserted a second full set of obligations and the
-- debtor owed double. (Applied to the live DB via the Supabase migration tool;
-- this file keeps repo history in sync.)
alter table public.obligations
  add constraint obligations_penalty_to_user_unique unique (penalty_event_id, to_user);
