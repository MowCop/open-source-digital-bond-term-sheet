CREATE TABLE public.copilot_general_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.copilot_general_messages TO authenticated;
GRANT ALL ON public.copilot_general_messages TO service_role;
ALTER TABLE public.copilot_general_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own general messages select" ON public.copilot_general_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own general messages insert" ON public.copilot_general_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own general messages delete" ON public.copilot_general_messages FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX ON public.copilot_general_messages (user_id, created_at);

CREATE TABLE public.copilot_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  deal_id text,
  label text NOT NULL,
  trigger_kind text NOT NULL CHECK (trigger_kind IN ('stage_reached','date')),
  trigger_stage text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','fired','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  fired_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.copilot_reminders TO authenticated;
GRANT ALL ON public.copilot_reminders TO service_role;
ALTER TABLE public.copilot_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders select" ON public.copilot_reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own reminders insert" ON public.copilot_reminders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own reminders update" ON public.copilot_reminders FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ON public.copilot_reminders (user_id, status);