-- Move webhook_secret off of profiles (where every authenticated user can read it
-- due to the relaxed read policy) into a new table with self-only RLS.

create table if not exists public.profile_secrets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  webhook_secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill: copy each profile's existing webhook_secret into the new table.
insert into public.profile_secrets (user_id, webhook_secret)
select id, webhook_secret
from public.profiles
where webhook_secret is not null
on conflict (user_id) do nothing;

alter table public.profile_secrets enable row level security;

drop policy if exists "secrets_self_select" on public.profile_secrets;
create policy "secrets_self_select" on public.profile_secrets
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "secrets_self_update" on public.profile_secrets;
create policy "secrets_self_update" on public.profile_secrets
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists trg_profile_secrets_updated on public.profile_secrets;
create trigger trg_profile_secrets_updated
  before update on public.profile_secrets
  for each row execute function public.tg_set_updated_at();

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

  return new;
end
$func$;

alter table public.profiles drop column if exists webhook_secret;
