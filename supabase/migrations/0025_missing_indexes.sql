-- Add indexes that were missing on frequently-queried foreign key columns.

-- challenge_invitations.from_user is used in RLS policy checks and in queries
-- like "show challenges I've sent" but had no index (only to_user was indexed).
create index if not exists challenge_invitations_from_user_idx
  on public.challenge_invitations (from_user);

-- period_sharing.shared_with_id is the column filtered by the grantee_read
-- RLS policy and by queries that load "shares granted to me". The composite
-- primary key (owner_id, shared_with_id) covers owner-side lookups but not
-- grantee-side lookups.
create index if not exists period_sharing_shared_with_idx
  on public.period_sharing (shared_with_id);
