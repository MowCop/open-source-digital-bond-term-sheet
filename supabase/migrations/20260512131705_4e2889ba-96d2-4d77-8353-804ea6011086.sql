
-- USERS
DROP POLICY IF EXISTS "anon read users" ON public.users;
DROP POLICY IF EXISTS "anon write users" ON public.users;
DROP POLICY IF EXISTS "anon update users" ON public.users;
DROP POLICY IF EXISTS "anon delete users" ON public.users;
CREATE POLICY "auth read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin update users" ON public.users FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin delete users" ON public.users FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- DEALS
DROP POLICY IF EXISTS "anon read deals" ON public.deals;
DROP POLICY IF EXISTS "anon write deals" ON public.deals;
DROP POLICY IF EXISTS "anon update deals" ON public.deals;
DROP POLICY IF EXISTS "anon delete deals" ON public.deals;
CREATE POLICY "auth read deals" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update deals" ON public.deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete deals" ON public.deals FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- MESSAGES
DROP POLICY IF EXISTS "anon read messages" ON public.messages;
DROP POLICY IF EXISTS "anon write messages" ON public.messages;
DROP POLICY IF EXISTS "anon update messages" ON public.messages;
DROP POLICY IF EXISTS "anon delete messages" ON public.messages;
CREATE POLICY "auth read messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update messages" ON public.messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete messages" ON public.messages FOR DELETE TO authenticated USING (true);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "anon read notifs" ON public.notifications;
DROP POLICY IF EXISTS "anon write notifs" ON public.notifications;
DROP POLICY IF EXISTS "anon update notifs" ON public.notifications;
DROP POLICY IF EXISTS "anon delete notifs" ON public.notifications;
CREATE POLICY "auth read notifs" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write notifs" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update notifs" ON public.notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete notifs" ON public.notifications FOR DELETE TO authenticated USING (true);

-- DISTRIBUTION LISTS
DROP POLICY IF EXISTS "anon read dl" ON public.distribution_lists;
DROP POLICY IF EXISTS "anon write dl" ON public.distribution_lists;
DROP POLICY IF EXISTS "anon update dl" ON public.distribution_lists;
DROP POLICY IF EXISTS "anon delete dl" ON public.distribution_lists;
CREATE POLICY "auth read dl" ON public.distribution_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write dl" ON public.distribution_lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update dl" ON public.distribution_lists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete dl" ON public.distribution_lists FOR DELETE TO authenticated USING (true);

-- CHAT CHANNELS
DROP POLICY IF EXISTS "anon read cc" ON public.chat_channels;
DROP POLICY IF EXISTS "anon write cc" ON public.chat_channels;
DROP POLICY IF EXISTS "anon update cc" ON public.chat_channels;
DROP POLICY IF EXISTS "anon delete cc" ON public.chat_channels;
CREATE POLICY "auth read cc" ON public.chat_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cc" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cc" ON public.chat_channels FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cc" ON public.chat_channels FOR DELETE TO authenticated USING (true);

-- CHAT MESSAGES
DROP POLICY IF EXISTS "anon read cm" ON public.chat_messages;
DROP POLICY IF EXISTS "anon write cm" ON public.chat_messages;
DROP POLICY IF EXISTS "anon update cm" ON public.chat_messages;
DROP POLICY IF EXISTS "anon delete cm" ON public.chat_messages;
CREATE POLICY "auth read cm" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cm" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cm" ON public.chat_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cm" ON public.chat_messages FOR DELETE TO authenticated USING (true);

-- AUDIT LOG: remove public read + public insert
DROP POLICY IF EXISTS "read non-master audit" ON public.audit_log;
DROP POLICY IF EXISTS "anon write audit" ON public.audit_log;
CREATE POLICY "auth write audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
