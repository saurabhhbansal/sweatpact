do $$ 
declare
    rec record;
begin
    -- 1. Drop UNIQUE(user_id) constraint on group_members
    for rec in 
        select conname 
        from pg_constraint 
        where conrelid = 'public.group_members'::regclass and contype = 'u'
    loop
        execute 'alter table public.group_members drop constraint ' || rec.conname;
    end loop;

    -- 2. Drop constraint on group_members.role
    for rec in 
        select conname 
        from pg_constraint 
        where conrelid = 'public.group_members'::regclass and contype = 'c' 
          and pg_get_constraintdef(oid) ilike '%role%'
    loop
        execute 'alter table public.group_members drop constraint ' || rec.conname;
    end loop;

    -- 3. Drop constraints on checkin_events.status
    for rec in 
        select conname 
        from pg_constraint 
        where conrelid = 'public.checkin_events'::regclass and contype = 'c' 
          and pg_get_constraintdef(oid) ilike '%status%'
    loop
        execute 'alter table public.checkin_events drop constraint ' || rec.conname;
    end loop;
    
    -- 4. Drop constraints on daily_status.status
    for rec in 
        select conname 
        from pg_constraint 
        where conrelid = 'public.daily_status'::regclass and contype = 'c' 
          and pg_get_constraintdef(oid) ilike '%status%'
    loop
        execute 'alter table public.daily_status drop constraint ' || rec.conname;
    end loop;
end $$;

-- Update role constraint
alter table public.group_members
  add constraint group_members_role_check check (role in ('owner','member','admin'));

-- Update checkin_events status
alter table public.checkin_events
  add constraint checkin_events_status_check check (status in ('verified','unverified','sick_day','gym_closed','rest_day','period_day','rejected'));

-- Update daily_status status
alter table public.daily_status
  add constraint daily_status_status_check check (status in ('verified','unverified','missed','sick_day','gym_closed','rest_day','period_day','rejected'));

-- Drop group_id from profiles securely (first dropping any dependent views/policies could be done if cascaded, we just drop column)
alter table public.profiles drop column if exists group_id cascade;

-- Rewrite same_group_as_me using group_members
create or replace function public.same_group_as_me(target_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members gm
    where gm.user_id = auth.uid() and gm.group_id = target_group
  );
$$;

-- Note: Since profiles no longer has group_id, the policy on profiles needs to be updated.
-- Previously: create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.same_group_as_me(group_id));
-- New: can read self or anyone who shares a group via group_members intersection
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (
    id = auth.uid() or 
    exists (
      select 1 from public.group_members my_gm
      join public.group_members their_gm on my_gm.group_id = their_gm.group_id
      where my_gm.user_id = auth.uid() and their_gm.user_id = profiles.id
    )
  );

