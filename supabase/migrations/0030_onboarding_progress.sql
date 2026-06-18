-- Onboarding walkthrough progress: one durable row per user (server-side source of
-- truth for tour state going forward — D-03). Owner-only RLS on all four verbs.
-- A row is provisioned for every existing profile (D-02 backfill) and for every new
-- profile via the extended handle_new_user() trigger (D-01), so a row always exists.

create table if not exists public.onboarding_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mandatory_done boolean not null default false,
  tour_version integer not null default 1,
  last_step_id text,
  completed_steps jsonb not null default '[]'::jsonb,
  dismissed boolean not null default false,
  completed_at timestamptz
);

alter table public.onboarding_progress enable row level security;

drop policy if exists "onboarding_progress_select_own" on public.onboarding_progress;
create policy "onboarding_progress_select_own" on public.onboarding_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "onboarding_progress_insert_own" on public.onboarding_progress;
create policy "onboarding_progress_insert_own" on public.onboarding_progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "onboarding_progress_update_own" on public.onboarding_progress;
create policy "onboarding_progress_update_own" on public.onboarding_progress
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "onboarding_progress_delete_own" on public.onboarding_progress;
create policy "onboarding_progress_delete_own" on public.onboarding_progress
  for delete to authenticated using (auth.uid() = user_id);

-- Backfill (D-02): seed a row for every existing profile. Users already marked
-- onboarding_complete=true get a done-row (never re-tutorialized); everyone else
-- gets a blank row. profiles.onboarding_complete was added in 0014. Idempotent via
-- on conflict (user_id) do nothing — safe to re-run.
insert into public.onboarding_progress (
  user_id, mandatory_done, dismissed, completed_at, completed_steps
)
select
  id,
  case when onboarding_complete then true else false end,
  case when onboarding_complete then true else false end,
  case when onboarding_complete then now() else null end,
  '[]'::jsonb
from public.profiles
on conflict (user_id) do nothing;

-- Extend handle_new_user() (D-01, Option A) so a progress row is auto-created for
-- every new profile. create or replace replaces the whole body, so the existing
-- profiles and profile_secrets inserts (from 0016) are preserved verbatim and the
-- onboarding_progress insert is added before return new.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $func$
begin
  insert into public.profiles (id, email, name, gender)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'gender'
  )
  on conflict (id) do nothing;

  insert into public.profile_secrets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.onboarding_progress (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end
$func$;
