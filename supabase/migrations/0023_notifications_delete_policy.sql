-- Allow users to delete their own notifications (dismiss / clear-all).
-- The table has RLS enabled but was missing a DELETE policy, causing
-- dismiss/clear-all to silently succeed with 0 rows affected.
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete using (auth.uid() = user_id);
