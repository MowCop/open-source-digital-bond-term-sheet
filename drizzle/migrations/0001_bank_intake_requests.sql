CREATE TABLE public.bank_intake_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  institution text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  desk_role text,
  request_types text[] NOT NULL DEFAULT '{}',
  internal_systems text[] NOT NULL DEFAULT '{}',
  requirements text,
  deal_id text,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bank_intake_requests TO authenticated;
GRANT ALL ON public.bank_intake_requests TO service_role;
ALTER TABLE public.bank_intake_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own intake" ON public.bank_intake_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own intake, master admins read all" ON public.bank_intake_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master_admin'));