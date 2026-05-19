
-- PDF annotations table
CREATE TABLE public.pdf_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attachment_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  xfdf TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (attachment_id, user_id)
);

CREATE INDEX idx_pdf_annotations_attachment ON public.pdf_annotations(attachment_id);

ALTER TABLE public.pdf_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pdf annotations"
ON public.pdf_annotations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "owner insert pdf annotations"
ON public.pdf_annotations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "owner update pdf annotations"
ON public.pdf_annotations FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "owner delete pdf annotations"
ON public.pdf_annotations FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER pdf_annotations_updated_at
BEFORE UPDATE ON public.pdf_annotations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Private storage bucket for flattened PDF versions
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-versions', 'pdf-versions', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read pdf versions"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pdf-versions');

CREATE POLICY "admin write pdf versions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pdf-versions' AND public.is_admin(auth.uid()));

CREATE POLICY "admin update pdf versions"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pdf-versions' AND public.is_admin(auth.uid()));

CREATE POLICY "admin delete pdf versions"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pdf-versions' AND public.is_admin(auth.uid()));
