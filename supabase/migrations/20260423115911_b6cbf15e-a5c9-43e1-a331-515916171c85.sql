-- Messages
CREATE TABLE public.messages (
  id text PRIMARY KEY,
  deal_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL,
  sender_id text NOT NULL,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  retracted_at timestamptz,
  retracted_by text,
  thread_id text,
  parent_message_id text,
  ai_suggestions jsonb
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read messages"   ON public.messages FOR SELECT USING (true);
CREATE POLICY "anon write messages"  ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update messages" ON public.messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete messages" ON public.messages FOR DELETE USING (true);
CREATE TRIGGER messages_set_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit log
CREATE TABLE public.audit_log (
  id text PRIMARY KEY,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  user_id text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  details text NOT NULL,
  ip_address text
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read audit"   ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "anon write audit"  ON public.audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update audit" ON public.audit_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete audit" ON public.audit_log FOR DELETE USING (true);

-- Notifications
CREATE TABLE public.notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  timestamp timestamptz NOT NULL DEFAULT now(),
  deal_id text,
  message_id text
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read notifs"   ON public.notifications FOR SELECT USING (true);
CREATE POLICY "anon write notifs"  ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update notifs" ON public.notifications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete notifs" ON public.notifications FOR DELETE USING (true);

-- Distribution lists
CREATE TABLE public.distribution_lists (
  id text PRIMARY KEY,
  name text NOT NULL,
  member_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  vendor_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  last_used timestamptz
);
ALTER TABLE public.distribution_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read dl"   ON public.distribution_lists FOR SELECT USING (true);
CREATE POLICY "anon write dl"  ON public.distribution_lists FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update dl" ON public.distribution_lists FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete dl" ON public.distribution_lists FOR DELETE USING (true);

-- Chat channels
CREATE TABLE public.chat_channels (
  id text PRIMARY KEY,
  participant_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  deal_id text,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read cc"   ON public.chat_channels FOR SELECT USING (true);
CREATE POLICY "anon write cc"  ON public.chat_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update cc" ON public.chat_channels FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete cc" ON public.chat_channels FOR DELETE USING (true);

-- Chat messages
CREATE TABLE public.chat_messages (
  id text PRIMARY KEY,
  channel_id text NOT NULL,
  deal_id text,
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  sender_type text NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_message_id text,
  timestamp timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read cm"   ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "anon write cm"  ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update cm" ON public.chat_messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete cm" ON public.chat_messages FOR DELETE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.distribution_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;