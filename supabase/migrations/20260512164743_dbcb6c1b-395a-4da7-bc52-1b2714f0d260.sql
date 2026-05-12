
-- Scope notifications SELECT to owner or admin
DROP POLICY IF EXISTS "auth read notifs" ON public.notifications;
CREATE POLICY "owner read notifs" ON public.notifications
  FOR SELECT TO authenticated
  USING ((user_id = (auth.uid())::text) OR is_admin(auth.uid()));

-- Scope users SELECT to admins only (non-admin authenticated users have no need to enumerate the directory;
-- guest sessions bypass Supabase auth entirely)
DROP POLICY IF EXISTS "auth read users" ON public.users;
CREATE POLICY "admin read users" ON public.users
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
