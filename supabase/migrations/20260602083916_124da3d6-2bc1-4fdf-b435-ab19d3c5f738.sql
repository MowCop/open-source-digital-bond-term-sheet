
-- 1. is_approved helper (security definer to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.is_approved(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = uid AND status = 'approved'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, anon, service_role;

-- 2. Gate sensitive table reads/writes on approval status
DROP POLICY IF EXISTS "auth read deals" ON public.deals;
CREATE POLICY "approved read deals" ON public.deals FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "auth read messages" ON public.messages;
CREATE POLICY "approved read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "sender write messages" ON public.messages;
CREATE POLICY "sender write messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (auth.uid())::text AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "auth read cm" ON public.chat_messages;
CREATE POLICY "approved read cm" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "sender write cm" ON public.chat_messages;
CREATE POLICY "sender write cm" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (auth.uid())::text AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "auth read cc" ON public.chat_channels;
CREATE POLICY "approved read cc" ON public.chat_channels FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "auth read dl" ON public.distribution_lists;
CREATE POLICY "approved read dl" ON public.distribution_lists FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

-- 3. Prevent profile status self-escalation via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_status_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only admins can change profile status';
    END IF;
  END IF;
  -- Also prevent self-changing email to something unexpected isn't required here;
  -- focus on status escalation.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_status_self_update ON public.profiles;
CREATE TRIGGER profiles_prevent_status_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_status_self_update();

-- 4. Restrict pdf_annotations reads to owner or admin
DROP POLICY IF EXISTS "auth read pdf annotations" ON public.pdf_annotations;
CREATE POLICY "owner read pdf annotations" ON public.pdf_annotations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 5. Restrict message-attachments storage reads to uploader (folder owner) or admins
DROP POLICY IF EXISTS "Auth read message attachments" ON storage.objects;
CREATE POLICY "Owner read message attachments" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_admin(auth.uid())
    )
  );
