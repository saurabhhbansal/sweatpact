-- Period data sharing: female users can grant specific other users read access
-- to their cycle data, surfaced on their public profile via a "See cycle data"
-- button that opens a read-only Cycle view.

create table if not exists public.period_sharing (
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  shared_with_id uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (owner_id, shared_with_id)
);

alter table public.period_sharing enable row level security;

-- Owner can read and manage their own sharing rows.
create policy "owner_manage" on public.period_sharing
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Grantee can read rows that grant them access (so they know they can view it).
create policy "grantee_read" on public.period_sharing
  for select using (shared_with_id = auth.uid());
