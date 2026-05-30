-- Period tracking from Apple Health. One row per (user, local_day) holding the
-- highest flow level reported. Source distinguishes Apple Health auto-sync
-- from manual entries (currently not used, reserved for future).

alter table public.profiles
  add column if not exists period_sync_enabled boolean not null default false,
  add column if not exists period_last_synced_at timestamptz;

create table if not exists public.period_records (
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_day date not null,
  flow_level text not null check (flow_level in ('light','medium','heavy','unspecified')),
  source text not null default 'health' check (source in ('health','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_day)
);
create index if not exists period_records_user_day_idx on public.period_records (user_id, local_day desc);

alter table public.period_records enable row level security;

drop policy if exists "period_self_select" on public.period_records;
create policy "period_self_select" on public.period_records
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "period_self_insert" on public.period_records;
create policy "period_self_insert" on public.period_records
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "period_self_update" on public.period_records;
create policy "period_self_update" on public.period_records
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "period_self_delete" on public.period_records;
create policy "period_self_delete" on public.period_records
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists trg_period_records_updated on public.period_records;
create trigger trg_period_records_updated
  before update on public.period_records
  for each row execute function public.tg_set_updated_at();
