ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS bdt_state jsonb;

CREATE TABLE public.deal_term_sheet_releases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id text NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  version integer NOT NULL,
  stage integer NOT NULL,
  stage_label text NOT NULL DEFAULT '',
  bdt_state_snapshot jsonb NOT NULL,
  bdt_xml text,
  envelope jsonb,
  diff_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  checks_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  released_by text,
  released_by_name text,
  released_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (deal_id, version)
);

GRANT SELECT, INSERT ON public.deal_term_sheet_releases TO authenticated;
GRANT ALL ON public.deal_term_sheet_releases TO service_role;

ALTER TABLE public.deal_term_sheet_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Readable by users with deal access"
  ON public.deal_term_sheet_releases FOR SELECT
  TO authenticated
  USING (public.can_access_deal(deal_id));

CREATE POLICY "Admins can create releases"
  ON public.deal_term_sheet_releases FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_dtsr_deal_version ON public.deal_term_sheet_releases (deal_id, version DESC);