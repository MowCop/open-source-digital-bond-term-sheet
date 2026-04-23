-- Stage 1: deals + users tables for BondVDR shared test data
-- NOTE: No authentication. Permissive RLS allows the anon key to read/write.
-- This is a shared sandbox; do NOT use for real data.

CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  organization TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE public.deals (
  id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stage_history JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Party / Issuer
  issuer_name TEXT NOT NULL,
  issuer_lei TEXT,
  issuer_rating TEXT,
  rating_outlook TEXT,
  bookrunners JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Issuance
  issuance_type TEXT,
  currency TEXT NOT NULL,
  size TEXT NOT NULL,
  specified_denomination TEXT,
  pricing_date TEXT,
  issue_date TEXT,
  settlement_date TEXT,
  issue_price TEXT,
  reoffer_price TEXT,
  reoffer_yield TEXT,
  reoffer_spread TEXT,
  mid_swap_rate TEXT,
  coupon TEXT NOT NULL,
  governing_law TEXT,
  selling_restrictions TEXT,
  listing_venue TEXT,

  -- Product
  isin TEXT,
  cusip TEXT,
  common_code TEXT,
  form_of_note TEXT,
  status_of_note TEXT,
  tenor TEXT NOT NULL,
  maturity_date TEXT,
  interest_type TEXT,
  interest_rate TEXT,
  interest_payment_frequency TEXT,
  day_count_fraction TEXT,
  business_day_convention TEXT,
  optionality TEXT,
  taxonomy TEXT
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Permissive policies: shared test data, no auth.
CREATE POLICY "anon read users"   ON public.users FOR SELECT USING (true);
CREATE POLICY "anon write users"  ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update users" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete users" ON public.users FOR DELETE USING (true);

CREATE POLICY "anon read deals"   ON public.deals FOR SELECT USING (true);
CREATE POLICY "anon write deals"  ON public.deals FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update deals" ON public.deals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon delete deals" ON public.deals FOR DELETE USING (true);

-- updated_at trigger for deals
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER deals_set_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.deals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;