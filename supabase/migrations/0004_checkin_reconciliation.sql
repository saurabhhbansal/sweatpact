alter table public.checkin_events
  add column if not exists submission_id uuid;

update public.checkin_events
set submission_id = coalesce(submission_id, id)
where submission_id is null;

alter table public.checkin_events
  alter column submission_id set default gen_random_uuid();

alter table public.checkin_events
  alter column submission_id set not null;

create index if not exists idx_checkins_submission on public.checkin_events(submission_id);
create index if not exists idx_checkins_user_day_submission on public.checkin_events(user_id, local_day, submission_id);

alter table public.penalty_events
  drop constraint if exists penalty_events_user_id_local_day_reason_key;

drop index if exists public.penalty_events_user_id_local_day_reason_key;
drop index if exists public.penalty_events_user_day_group_reason_idx;

create unique index if not exists penalty_events_user_day_group_reason_idx
  on public.penalty_events (
    user_id,
    local_day,
    reason,
    coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
