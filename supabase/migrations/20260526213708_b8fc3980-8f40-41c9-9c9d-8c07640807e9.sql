
DROP POLICY IF EXISTS "Message attachments are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload message attachments" ON storage.objects;

ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_log;
