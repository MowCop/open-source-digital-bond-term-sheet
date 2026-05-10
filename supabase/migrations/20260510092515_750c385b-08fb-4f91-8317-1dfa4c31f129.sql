
DROP POLICY IF EXISTS "anon read audit" ON public.audit_log;
DROP POLICY IF EXISTS "anon update audit" ON public.audit_log;
DROP POLICY IF EXISTS "anon delete audit" ON public.audit_log;

CREATE POLICY "read non-master audit"
ON public.audit_log FOR SELECT
USING (entity_type <> 'master_admin');

CREATE POLICY "master reads all audit"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'master_admin'));

CREATE POLICY "master updates audit"
ON public.audit_log FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'master_admin'))
WITH CHECK (public.has_role(auth.uid(), 'master_admin'));

CREATE POLICY "master deletes audit"
ON public.audit_log FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'master_admin'));
