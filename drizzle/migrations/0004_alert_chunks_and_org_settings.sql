CREATE TABLE public.org_alert_settings (
  org text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend','microsoft_graph','gmail')),
  syndicate_mailbox text CHECK (syndicate_mailbox IS NULL OR syndicate_mailbox ~* '^[A-Za-z0-9._%+''-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$'),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.org_alert_settings TO authenticated;
GRANT ALL ON public.org_alert_settings TO service_role;
ALTER TABLE public.org_alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read alert settings" ON public.org_alert_settings FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()) AND org = COALESCE(public.current_user_org(), ''));
CREATE POLICY "Org admins insert alert settings" ON public.org_alert_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND org = COALESCE(public.current_user_org(), ''));
CREATE POLICY "Org admins update alert settings" ON public.org_alert_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND org = COALESCE(public.current_user_org(), ''))
  WITH CHECK (public.is_admin(auth.uid()) AND org = COALESCE(public.current_user_org(), ''));

ALTER TABLE public.alert_sends
  ADD COLUMN sender_email text,
  ADD COLUMN sender_org text,
  ADD COLUMN provider text NOT NULL DEFAULT 'resend',
  ADD COLUMN reply_to text,
  ADD COLUMN to_address text;
COMMENT ON COLUMN public.alert_sends.bcc IS 'DEPRECATED: syndicate mailbox now comes from org_alert_settings and is stored in alert_send_chunks.bcc_addresses';

CREATE TABLE public.alert_send_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.alert_sends(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  to_address text NOT NULL,
  bcc_addresses text[] NOT NULL DEFAULT '{}',
  vendor_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (send_id, chunk_index)
);
GRANT SELECT ON public.alert_send_chunks TO authenticated;
GRANT ALL ON public.alert_send_chunks TO service_role;
ALTER TABLE public.alert_send_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deal members read alert chunks" ON public.alert_send_chunks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alert_sends s WHERE s.id = alert_send_chunks.send_id AND public.can_access_deal(s.deal_id)));

INSERT INTO public.alert_send_chunks (send_id, chunk_index, to_address, bcc_addresses, vendor_ids, status, attempts, updated_at)
SELECT send_id, grp, '', array_agg(address ORDER BY rn), array_agg(DISTINCT vendor_id),
       CASE WHEN bool_or(status = 'failed') THEN 'failed' ELSE 'sent' END, max(attempts), max(updated_at)
FROM (SELECT r.*, ((row_number() OVER (PARTITION BY send_id ORDER BY id)) - 1) / 50 AS grp,
             row_number() OVER (PARTITION BY send_id ORDER BY id) AS rn
      FROM public.alert_send_recipients r) x
GROUP BY send_id, grp;
COMMENT ON TABLE public.alert_send_recipients IS 'DEPRECATED: replaced by alert_send_chunks';