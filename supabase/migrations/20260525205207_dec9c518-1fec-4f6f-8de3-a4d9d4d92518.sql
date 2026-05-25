
-- 1. Make message-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'message-attachments';

-- 2. Replace storage.objects policies for message-attachments
DROP POLICY IF EXISTS "Public can read message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth read message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner insert message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner update message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete message attachments" ON storage.objects;

-- Authenticated users can read attachments (via signed URLs / authorized client)
CREATE POLICY "Auth read message attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'message-attachments');

-- Only the uploader can insert into their own folder (first path segment = auth.uid())
CREATE POLICY "Owner insert message attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin(auth.uid())
  )
);

-- Only the uploader (owner) or admins can update
CREATE POLICY "Owner update message attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (owner = auth.uid() OR (storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (owner = auth.uid() OR (storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
);

-- Only the uploader (owner) or admins can delete
CREATE POLICY "Owner delete message attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (owner = auth.uid() OR (storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
);

-- 3. Explicit service-role-only policy on support_request_rate_limit
DROP POLICY IF EXISTS "Service role manages rate limit" ON public.support_request_rate_limit;
CREATE POLICY "Service role manages rate limit"
ON public.support_request_rate_limit
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
