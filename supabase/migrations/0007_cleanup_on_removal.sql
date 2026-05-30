-- Automatically void pending obligations when a member leaves or is removed from a group,
-- and when a user's profile is deleted (account deletion).

------------------------------------------------------------
-- Trigger: void pending obligations on group_member removal
------------------------------------------------------------
create or replace function public.handle_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.obligations
  set
    status     = 'voided',
    updated_at = now()
  where group_id = OLD.group_id
    and status   = 'pending'
    and (from_user = OLD.user_id or to_user = OLD.user_id);

  return OLD;
end $$;

drop trigger if exists trg_member_removed on public.group_members;
create trigger trg_member_removed
  after delete on public.group_members
  for each row execute function public.handle_member_removed();

------------------------------------------------------------
-- Trigger: void pending obligations before profile deletion
-- (The existing ON DELETE CASCADE will then remove the rows,
--  but status='voided' ensures in-flight reads see it correctly.)
------------------------------------------------------------
create or replace function public.handle_profile_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.obligations
  set
    status     = 'voided',
    updated_at = now()
  where status = 'pending'
    and (from_user = OLD.id or to_user = OLD.id);

  return OLD;
end $$;

drop trigger if exists trg_profile_deleted on public.profiles;
create trigger trg_profile_deleted
  before delete on public.profiles
  for each row execute function public.handle_profile_deleted();
