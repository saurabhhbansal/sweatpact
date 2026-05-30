-- Replace the profile-delete trigger to: void obligations, promote a new owner
-- for any group this user owns (next admin, then oldest other member), and
-- clean stale notification payload references. Groups with no other members
-- still cascade-delete via the existing FK.

create or replace function public.handle_profile_deleted()
returns trigger language plpgsql security definer set search_path = public
as $func$
begin
  -- 1) Void any still-pending obligations involving this user.
  update public.obligations
  set status = 'voided', updated_at = now()
  where status = 'pending'
    and (from_user = OLD.id or to_user = OLD.id);

  -- 2) Promote a new owner for groups currently owned by this user (if any
  -- other member exists). Pick first by role=admin asc, then oldest joined_at.
  update public.groups g
  set owner_id = sub.user_id
  from (
    select distinct on (gm.group_id) gm.group_id, gm.user_id
    from public.group_members gm
    where gm.group_id in (select id from public.groups where owner_id = OLD.id)
      and gm.user_id <> OLD.id
    order by gm.group_id, case when gm.role = 'admin' then 0 else 1 end, gm.joined_at asc
  ) sub
  where g.id = sub.group_id;

  -- 3) Mark the promoted member's role as 'owner' in group_members.
  update public.group_members gm
  set role = 'owner'
  where gm.role <> 'owner'
    and exists (
      select 1 from public.groups g
      where g.id = gm.group_id and g.owner_id = gm.user_id
    );

  -- 4) Clean stale notifications referencing this user in their JSON payload.
  delete from public.notifications
  where (payload ->> 'from_user') = OLD.id::text
     or (payload ->> 'by_user')   = OLD.id::text;

  return OLD;
end
$func$;
