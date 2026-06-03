-- 1) message-attachments bucket: require approval for upload/read
DROP POLICY IF EXISTS "Owner insert message attachments" ON storage.objects;
CREATE POLICY "Owner insert message attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND public.is_approved(auth.uid())
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Owner read message attachments" ON storage.objects;
CREATE POLICY "Owner read message attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND public.is_approved(auth.uid())
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR public.is_admin(auth.uid())
  )
);

-- 2) pdf-versions bucket: require approval to read
DROP POLICY IF EXISTS "auth read pdf versions" ON storage.objects;
CREATE POLICY "auth read pdf versions"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pdf-versions'
  AND public.is_approved(auth.uid())
);

-- 3) Remove sensitive users table from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.users;

-- 4) Restrict Realtime channel subscriptions to approved users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can receive realtime" ON realtime.messages;
CREATE POLICY "Approved users can receive realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Approved users can send realtime" ON realtime.messages;
CREATE POLICY "Approved users can send realtime"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (public.is_approved(auth.uid()));