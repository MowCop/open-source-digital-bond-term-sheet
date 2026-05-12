
-- =========================================================
-- DEALS: restrict INSERT/UPDATE to admins
-- =========================================================
DROP POLICY IF EXISTS "auth write deals" ON public.deals;
DROP POLICY IF EXISTS "auth update deals" ON public.deals;

CREATE POLICY "admin write deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin update deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- DISTRIBUTION LISTS: restrict all writes to admins
-- =========================================================
DROP POLICY IF EXISTS "auth write dl" ON public.distribution_lists;
DROP POLICY IF EXISTS "auth update dl" ON public.distribution_lists;
DROP POLICY IF EXISTS "auth delete dl" ON public.distribution_lists;

CREATE POLICY "admin write dl" ON public.distribution_lists
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin update dl" ON public.distribution_lists
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete dl" ON public.distribution_lists
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- CHAT CHANNELS: restrict create/update/delete to admins
-- =========================================================
DROP POLICY IF EXISTS "auth write cc" ON public.chat_channels;
DROP POLICY IF EXISTS "auth update cc" ON public.chat_channels;
DROP POLICY IF EXISTS "auth delete cc" ON public.chat_channels;

CREATE POLICY "admin write cc" ON public.chat_channels
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin update cc" ON public.chat_channels
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete cc" ON public.chat_channels
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- CHAT MESSAGES: sender-only writes; admin delete
-- =========================================================
DROP POLICY IF EXISTS "auth write cm" ON public.chat_messages;
DROP POLICY IF EXISTS "auth update cm" ON public.chat_messages;
DROP POLICY IF EXISTS "auth delete cm" ON public.chat_messages;

CREATE POLICY "sender write cm" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()::text);

CREATE POLICY "sender update cm" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()::text OR public.is_admin(auth.uid()))
  WITH CHECK (sender_id = auth.uid()::text OR public.is_admin(auth.uid()));

CREATE POLICY "admin delete cm" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- MESSAGES: sender-only writes; admin delete
-- =========================================================
DROP POLICY IF EXISTS "auth write messages" ON public.messages;
DROP POLICY IF EXISTS "auth update messages" ON public.messages;
DROP POLICY IF EXISTS "auth delete messages" ON public.messages;

CREATE POLICY "sender write messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()::text);

CREATE POLICY "sender update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()::text OR public.is_admin(auth.uid()))
  WITH CHECK (sender_id = auth.uid()::text OR public.is_admin(auth.uid()));

CREATE POLICY "admin delete messages" ON public.messages
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- NOTIFICATIONS: user-scoped writes; admin/self delete
-- =========================================================
DROP POLICY IF EXISTS "auth write notifs" ON public.notifications;
DROP POLICY IF EXISTS "auth update notifs" ON public.notifications;
DROP POLICY IF EXISTS "auth delete notifs" ON public.notifications;

CREATE POLICY "auth insert notifs" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin(auth.uid()));

CREATE POLICY "owner update notifs" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin(auth.uid()));

CREATE POLICY "owner delete notifs" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin(auth.uid()));

-- =========================================================
-- AUDIT LOG: tighten insert (was WITH CHECK true)
-- =========================================================
DROP POLICY IF EXISTS "auth write audit" ON public.audit_log;
CREATE POLICY "auth insert audit" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin(auth.uid()));

-- =========================================================
-- SECURITY DEFINER email queue helpers:
--   - Pin search_path
--   - Revoke EXECUTE from anon/authenticated (service_role only)
-- =========================================================
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
