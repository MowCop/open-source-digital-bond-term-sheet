DROP POLICY IF EXISTS "admins manage guest passcodes" ON public.guest_passcodes;

CREATE POLICY "master full access guest passcodes"
ON public.guest_passcodes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'master_admin'::app_role));

CREATE POLICY "syndicate read own guest passcodes"
ON public.guest_passcodes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'syndicate_admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "syndicate insert own guest passcodes"
ON public.guest_passcodes
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'syndicate_admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "syndicate update own guest passcodes"
ON public.guest_passcodes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'syndicate_admin'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'syndicate_admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "syndicate delete own guest passcodes"
ON public.guest_passcodes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'syndicate_admin'::app_role) AND created_by = auth.uid());