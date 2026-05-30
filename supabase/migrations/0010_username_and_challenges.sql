-- Username + profile visibility
alter table public.profiles
  add column if not exists username text,
  add column if not exists profile_visibility text not null default 'public'
    check (profile_visibility in ('public', 'private'));

-- Case-insensitive unique index on username
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

-- Username format check (3-20 chars, alphanumeric + underscore)
alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id);

-- Challenge invitations (accept/decline flow)
create table if not exists public.challenge_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  penalty_cents integer not null default 5000 check (penalty_cents >= 0),
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists challenge_invitations_to_user_pending_idx
  on public.challenge_invitations (to_user, status, created_at desc);
create index if not exists challenge_invitations_group_idx
  on public.challenge_invitations (group_id);

alter table public.challenge_invitations enable row level security;

drop policy if exists challenge_invitations_select_involved on public.challenge_invitations;
create policy challenge_invitations_select_involved on public.challenge_invitations
  for select using (auth.uid() = from_user or auth.uid() = to_user);

-- Backfill: assign auto-generated usernames to existing profiles missing one
update public.profiles
set username = 'user_' || substr(replace(id::text, '-', ''), 1, 8)
where username is null;
