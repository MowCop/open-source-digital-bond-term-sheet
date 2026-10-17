/** Deal document storage: every file dropped on a deal is kept in the deal-documents bucket. */
import { supabase } from '@/integrations/supabase/client';

export interface DealDocument {
  id: string; deal_id: string; name: string; path: string; size: number;
  mime: string | null; uploaded_by_name: string | null; created_at: string;
}

export const DOCS_CHANGED = 'vdr:deal-documents-changed';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listDealDocuments(dealId: string): Promise<DealDocument[]> {
  const { data, error } = await db.from('deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as DealDocument[];
}

/** Uploads one file and records it. Returns the stored path reference (vdr://...). */
export async function uploadDealDocument(dealId: string, file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${dealId}/${Date.now()}-${safe}`;
  const up = await supabase.storage.from('deal-documents').upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw up.error;
  const { data: saved, error } = await db.from('deal_documents').insert({
    deal_id: dealId, name: file.name, path, size: file.size, mime: file.type || null,
    uploaded_by: u.user?.id, uploaded_by_name: u.user?.user_metadata?.name ?? u.user?.email ?? null,
  }).select('id').single();
  if (error) throw error;
  window.dispatchEvent(new CustomEvent(DOCS_CHANGED, { detail: dealId }));
  if (saved?.id) void import('@/lib/copilot/client').then(c => c.onCopilotDocumentSaved(dealId, saved.id, file));
  return `vdr://deal-documents/${path}`;
}

export async function openDealDocument(path: string, download = false) {
  const { data, error } = await supabase.storage.from('deal-documents').createSignedUrl(path, 300, download ? { download: true } : undefined);
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener');
}

export async function deleteDealDocument(doc: DealDocument) {
  await supabase.storage.from('deal-documents').remove([doc.path]);
  const { error } = await db.from('deal_documents').delete().eq('id', doc.id);
  if (error) throw error;
  window.dispatchEvent(new CustomEvent(DOCS_CHANGED, { detail: doc.deal_id }));
}
