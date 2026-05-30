-- Gym Accountability MVP — initial schema
-- All money values stored in cents (integer) to avoid float drift.
-- "local_day" columns are DATE in the user's local timezone, computed server-side.

create extension if not exists "pgcrypto";

------------------------------------------------------------
-- profiles: 1:1 with auth.users
------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  timezone text not null default 'Asia/Kolkata',
  gym_lat double precision,
  gym_lng double precision,
  gym_radius_m integer not null default 150,
  daily_penalty_cents integer not null default 500,        -- $5 default
  wallet_balance_cents integer not null default 0,
  cutoff_local_time time not null default '22:00',         -- local clock time per user
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  group_id uuid,                                            -- exactly one group per user (FK below)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_group on public.profiles(group_id);

------------------------------------------------------------
-- groups
------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  default_penalty_cents integer not null default 500,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

-- Now that groups exists, attach the FK from profiles -> groups
alter table public.profiles
  drop constraint if exists profiles_group_id_fkey;
alter table public.profiles
  add constraint profiles_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete set null;

------------------------------------------------------------
-- group_members: redundant with profiles.group_id but useful for
-- queries / future expansion. Enforces one-group-per-user via UNIQUE(user_id).
------------------------------------------------------------
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (user_id) -- one group per user
);

create index if not exists idx_group_members_group on public.group_members(group_id);

------------------------------------------------------------
-- checkin_events: every attempt is logged
------------------------------------------------------------
create table if not exists public.checkin_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  occurred_at timestamptz not null default now(),
  local_day date not null,
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  status text not null check (status in ('verified','unverified')),
  source text not null check (source in ('shortcut','manual','admin')),
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkins_user_day on public.checkin_events(user_id, local_day);
create index if not exists idx_checkins_group_day on public.checkin_events(group_id, local_day);
create index if not exists idx_checkins_user_time on public.checkin_events(user_id, occurred_at desc);

------------------------------------------------------------
-- daily_status: idempotent per user/day; ensures one penalty/missed marker per day
------------------------------------------------------------
create table if not exists public.daily_status (
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_day date not null,
  status text not null check (status in ('verified','unverified','missed')),
  checkin_id uuid references public.checkin_events(id) on delete set null,
  enforced_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, local_day)
);

------------------------------------------------------------
-- penalty_events: a missed day creates one penalty_event
------------------------------------------------------------
create table if not exists public.penalty_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  local_day date not null,
  amount_cents integer not null,
  reason text not null default 'missed_checkin',
  created_at timestamptz not null default now(),
  unique (user_id, local_day, reason)
);

create index if not exists idx_penalty_group_day on public.penalty_events(group_id, local_day);

------------------------------------------------------------
-- obligations: ledger of who owes whom (split from a penalty_event)
------------------------------------------------------------
create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  penalty_event_id uuid references public.penalty_events(id) on delete cascade,
  checkin_event_id uuid references public.checkin_events(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending','settled','disputed','voided')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_obligations_from on public.obligations(from_user, status);
create index if not exists idx_obligations_to on public.obligations(to_user, status);
create index if not exists idx_obligations_group on public.obligations(group_id, created_at desc);

------------------------------------------------------------
-- settlements: record of manual settlement events
------------------------------------------------------------
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.obligations(id) on delete cascade,
  marked_by uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  note text,
  settled_at timestamptz not null default now()
);

------------------------------------------------------------
-- disputes: against a check-in or an obligation
------------------------------------------------------------
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete set null,
  raised_by uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('checkin','obligation')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved','rejected')),
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_disputes_group on public.disputes(group_id, created_at desc);
create index if not exists idx_disputes_target on public.disputes(target_type, target_id);

------------------------------------------------------------
-- dispute_votes: lightweight stance tracking
------------------------------------------------------------
create table if not exists public.dispute_votes (
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stance text not null check (stance in ('uphold','reject','abstain')),
  note text,
  created_at timestamptz not null default now(),
  primary key (dispute_id, user_id)
);

------------------------------------------------------------
-- audit_log: for debugging webhook abuse / general events
------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  payload jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_user_time on public.audit_log(user_id, created_at desc);

------------------------------------------------------------
-- updated_at triggers
------------------------------------------------------------
create or replace function public.tg_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_obligations_updated on public.obligations;
create trigger trg_obligations_updated before update on public.obligations
for each row execute function public.tg_set_updated_at();

------------------------------------------------------------
-- Auto-create profile row when a new auth user signs up
------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.checkin_events enable row level security;
alter table public.daily_status enable row level security;
alter table public.penalty_events enable row level security;
alter table public.obligations enable row level security;
alter table public.settlements enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_votes enable row level security;
alter table public.audit_log enable row level security;

-- Helper: same group as the current user?
create or replace function public.same_group_as_me(target_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.group_id = target_group
  );
$$;

-- profiles
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or public.same_group_as_me(group_id));

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- groups
drop policy if exists "group read" on public.groups;
create policy "group read" on public.groups
  for select using (
    public.same_group_as_me(id) or owner_id = auth.uid()
  );

drop policy if exists "group insert by anyone authed" on public.groups;
create policy "group insert by anyone authed" on public.groups
  for insert with check (owner_id = auth.uid());

drop policy if exists "group update by owner" on public.groups;
create policy "group update by owner" on public.groups
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- group_members
drop policy if exists "members read same group" on public.group_members;
create policy "members read same group" on public.group_members
  for select using (public.same_group_as_me(group_id));

-- checkin_events
drop policy if exists "checkins read group" on public.checkin_events;
create policy "checkins read group" on public.checkin_events
  for select using (user_id = auth.uid() or public.same_group_as_me(group_id));

-- daily_status
drop policy if exists "daily read self" on public.daily_status;
create policy "daily read self" on public.daily_status
  for select using (user_id = auth.uid());

-- penalty_events
drop policy if exists "penalty read group" on public.penalty_events;
create policy "penalty read group" on public.penalty_events
  for select using (user_id = auth.uid() or public.same_group_as_me(group_id));

-- obligations
drop policy if exists "oblig read group" on public.obligations;
create policy "oblig read group" on public.obligations
  for select using (
    from_user = auth.uid() or to_user = auth.uid() or public.same_group_as_me(group_id)
  );

-- settlements
drop policy if exists "settlements read group" on public.settlements;
create policy "settlements read group" on public.settlements
  for select using (
    exists (select 1 from public.obligations o
            where o.id = settlements.obligation_id
              and (o.from_user = auth.uid() or o.to_user = auth.uid() or public.same_group_as_me(o.group_id)))
  );

-- disputes
drop policy if exists "dispute read group" on public.disputes;
create policy "dispute read group" on public.disputes
  for select using (raised_by = auth.uid() or public.same_group_as_me(group_id));

drop policy if exists "dispute insert group" on public.disputes;
create policy "dispute insert group" on public.disputes
  for insert with check (raised_by = auth.uid() and public.same_group_as_me(group_id));

-- dispute_votes
drop policy if exists "vote read group" on public.dispute_votes;
create policy "vote read group" on public.dispute_votes
  for select using (
    exists (select 1 from public.disputes d
            where d.id = dispute_votes.dispute_id
              and (d.raised_by = auth.uid() or public.same_group_as_me(d.group_id)))
  );

drop policy if exists "vote upsert self" on public.dispute_votes;
create policy "vote upsert self" on public.dispute_votes
  for insert with check (user_id = auth.uid());
