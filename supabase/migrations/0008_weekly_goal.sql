-- Add per-user weekly goal for check-ins (independent of group settings).
alter table public.profiles
  add column if not exists weekly_goal integer not null default 4;

alter table public.profiles
  drop constraint if exists profiles_weekly_goal_check;
alter table public.profiles
  add constraint profiles_weekly_goal_check check (weekly_goal >= 1 and weekly_goal <= 7);

-- One-time cleanup: void any pending obligations where either party is no
-- longer a member of the group (handles data predating the trigger in 0007).
update public.obligations
set status = 'voided', updated_at = now()
where status = 'pending'
  and group_id is not null
  and (
    not exists (
      select 1 from public.group_members gm
      where gm.group_id = obligations.group_id
        and gm.user_id = obligations.from_user
    )
    or
    not exists (
      select 1 from public.group_members gm
      where gm.group_id = obligations.group_id
        and gm.user_id = obligations.to_user
    )
  );
