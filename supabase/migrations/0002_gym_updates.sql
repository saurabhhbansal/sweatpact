do $$ 
declare
    rec record;
begin
    -- Drop constraint on daily_status.status
    for rec in 
        select conname 
        from pg_constraint 
        where conrelid = 'public.daily_status'::regclass and contype = 'c' 
          and pg_get_constraintdef(oid) ilike '%status%'
    loop
        execute 'alter table public.daily_status drop constraint ' || rec.conname;
    end loop;

    -- Drop constraint on checkin_events.status if needed
    for rec in 
        select conname 
        from pg_constraint 
        where conrelid = 'public.checkin_events'::regclass and contype = 'c' 
          and pg_get_constraintdef(oid) ilike '%status%'
    loop
        execute 'alter table public.checkin_events drop constraint ' || rec.conname;
    end loop;
end $$;

alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female'));

alter table public.profiles
  drop column if exists wallet_balance_cents,
  drop column if exists daily_penalty_cents;

alter table public.group_members
  add column if not exists penalty_cents integer;

alter table public.daily_status
  add constraint daily_status_status_check check (status in ('verified','unverified','missed','sick_day','gym_closed','rest_day','period_day'));

alter table public.checkin_events
  add constraint checkin_events_status_check check (status in ('verified','unverified','sick_day','gym_closed','rest_day','period_day'));


create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, gender)
  values (
    new.id, 
    coalesce(new.email, ''), 
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'gender' 
  )
  on conflict (id) do nothing;
  return new;
end $$;

do $$
declare
    rec record;
begin
    -- Drop constraint on disputes.target_type
    for rec in 
        select conname 
        from pg_constraint 
        where conrelid = 'public.disputes'::regclass and contype = 'c' 
          and pg_get_constraintdef(oid) ilike '%target_type%'
    loop
        execute 'alter table public.disputes drop constraint ' || rec.conname;
    end loop;
end $$;

alter table public.disputes
  add constraint disputes_target_type_check check (target_type in ('checkin','obligation','penalty_event'));
