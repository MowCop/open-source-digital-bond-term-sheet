CREATE TABLE public.support_request_rate_limit (
  ip text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.support_request_rate_limit ENABLE ROW LEVEL SECURITY;