CREATE TABLE public.vendor_distribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org text NOT NULL,
  vendor_id text NOT NULL,
  vendor_name text NOT NULL DEFAULT '',
  addresses text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org, vendor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_distribution TO authenticated;
GRANT ALL ON public.vendor_distribution TO service_role;
ALTER TABLE public.vendor_distribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read distribution" ON public.vendor_distribution FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()) AND org = coalesce(public.current_user_org(), ''));
CREATE POLICY "Org admins insert distribution" ON public.vendor_distribution FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND org = coalesce(public.current_user_org(), ''));
CREATE POLICY "Org admins update distribution" ON public.vendor_distribution FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND org = coalesce(public.current_user_org(), ''))
  WITH CHECK (public.is_admin(auth.uid()) AND org = coalesce(public.current_user_org(), ''));
CREATE POLICY "Org admins delete distribution" ON public.vendor_distribution FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND org = coalesce(public.current_user_org(), ''));

CREATE TABLE public.deal_bulletin_notes (
  deal_id text PRIMARY KEY,
  intro text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.deal_bulletin_notes TO authenticated;
GRANT ALL ON public.deal_bulletin_notes TO service_role;
ALTER TABLE public.deal_bulletin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deal members read bulletin notes" ON public.deal_bulletin_notes FOR SELECT TO authenticated
  USING (public.can_access_deal(deal_id));
CREATE POLICY "Admins insert bulletin notes" ON public.deal_bulletin_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_deal(deal_id));
CREATE POLICY "Admins update bulletin notes" ON public.deal_bulletin_notes FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.can_access_deal(deal_id))
  WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_deal(deal_id));

CREATE TABLE public.alert_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  org text NOT NULL DEFAULT '',
  event text NOT NULL,
  stage text NOT NULL DEFAULT '',
  subject text NOT NULL,
  body_html text NOT NULL,
  release_id uuid REFERENCES public.deal_term_sheet_releases(id),
  release_version integer,
  bdt_hash text NOT NULL,
  terms_snapshot jsonb NOT NULL DEFAULT '{}',
  sender_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  bcc text,
  approved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alert_sends TO authenticated;
GRANT ALL ON public.alert_sends TO service_role;
ALTER TABLE public.alert_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deal members read alert sends" ON public.alert_sends FOR SELECT TO authenticated
  USING (public.can_access_deal(deal_id));

CREATE TABLE public.alert_send_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.alert_sends(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  vendor_name text NOT NULL DEFAULT '',
  address text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.alert_send_recipients TO authenticated;
GRANT ALL ON public.alert_send_recipients TO service_role;
ALTER TABLE public.alert_send_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deal members read alert recipients" ON public.alert_send_recipients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alert_sends s WHERE s.id = send_id AND public.can_access_deal(s.deal_id)));
CREATE INDEX alert_sends_deal_idx ON public.alert_sends(deal_id, created_at DESC);
CREATE INDEX alert_send_recipients_send_idx ON public.alert_send_recipients(send_id);