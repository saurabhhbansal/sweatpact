-- Challenge groups are now created only when an invitation is accepted, not when
-- it is sent. A pending invitation therefore has no group yet, so group_id must
-- be nullable. (Applied to the live database via the Supabase migration tool;
-- this file keeps the repo's migration history in sync.)
alter table public.challenge_invitations alter column group_id drop not null;
