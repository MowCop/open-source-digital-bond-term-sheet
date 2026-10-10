CREATE TABLE public.deal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  name text NOT NULL,
  path text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  mime text,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.deal_documents TO authenticated;
GRANT ALL ON public.deal_documents TO service_role;
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deal participants read documents" ON public.deal_documents FOR SELECT TO authenticated
  USING (public.can_access_deal(deal_id));
CREATE POLICY "Admins add documents" ON public.deal_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "Admins delete documents" ON public.deal_documents FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Deal participants read deal files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'deal-documents' AND public.can_access_deal((storage.foldername(name))[1]));
CREATE POLICY "Admins upload deal files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deal-documents' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete deal files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'deal-documents' AND public.is_admin(auth.uid()));