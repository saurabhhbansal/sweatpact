-- Lightweight fixed-window rate limiter backed by Postgres (no external store).
-- One row per (key, window) bucket; the function self-prunes a key's stale
-- buckets on each call. Internal-only: RLS denies all client access; the
-- security-definer function (called via the service-role admin client) is the
-- only writer. (Applied to the live DB via the Supabase migration tool; this
-- file keeps repo history in sync.)
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  delete from public.rate_limits where key = p_key and window_start < v_window;
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end;
$$;
