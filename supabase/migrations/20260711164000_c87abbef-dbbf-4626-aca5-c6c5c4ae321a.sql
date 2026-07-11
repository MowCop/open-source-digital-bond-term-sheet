CREATE TABLE public.sync_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  repo text,
  event_type text NOT NULL,
  status text NOT NULL,
  records_processed integer,
  error_message text,
  details jsonb,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sync_audit_log TO authenticated;
GRANT ALL ON public.sync_audit_log TO service_role;

ALTER TABLE public.sync_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync audit log"
  ON public.sync_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_sync_audit_log_created_at ON public.sync_audit_log (created_at DESC);
CREATE INDEX idx_sync_audit_log_source ON public.sync_audit_log (source);
CREATE INDEX idx_sync_audit_log_status ON public.sync_audit_log (status);