create table if not exists public.user_gyms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 150 check (radius_m >= 20 and radius_m <= 5000),
  created_at timestamptz not null default now()
);
create index if not exists user_gyms_user_id_idx on public.user_gyms(user_id);

alter table public.user_gyms enable row level security;

drop policy if exists "user_gyms_select_own" on public.user_gyms;
create policy "user_gyms_select_own" on public.user_gyms
  for select using (auth.uid() = user_id);

drop policy if exists "user_gyms_insert_own" on public.user_gyms;
create policy "user_gyms_insert_own" on public.user_gyms
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_gyms_update_own" on public.user_gyms;
create policy "user_gyms_update_own" on public.user_gyms
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_gyms_delete_own" on public.user_gyms;
create policy "user_gyms_delete_own" on public.user_gyms
  for delete using (auth.uid() = user_id);

-- Backfill existing single-gym profiles into user_gyms (one-time).
insert into public.user_gyms (user_id, name, lat, lng, radius_m)
select id, 'My gym', gym_lat, gym_lng, coalesce(gym_radius_m, 150)
from public.profiles
where gym_lat is not null
  and gym_lng is not null
  and not exists (
    select 1 from public.user_gyms g where g.user_id = profiles.id
  );
