CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "approved users read users" ON public.users
  FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));