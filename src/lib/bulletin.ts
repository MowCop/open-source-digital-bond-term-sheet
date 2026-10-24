import { supabase } from '@/integrations/supabase/client';
import { listDealDocuments } from '@/lib/dealDocuments';
import { selectSections } from '@/lib/deepAudit';
import { stripHtml } from '@/lib/htmlText';

/** Read original stored files, independently of Co-Pilot's shorter review limits. */
export async function bulletinDocuments(dealId: string) {
  const stored = (await listDealDocuments(dealId)).slice(0, 6);
  const docs: { name: string; text: string }[] = [], failed: string[] = [];
  for (const d of stored) {
    try {
      if (!/\.(pdf|docx|txt|md|html?)$/i.test(d.name)) continue;
      const { data, error } = await supabase.storage.from('deal-documents').download(d.path);
      if (error || !data) throw new Error('Download failed');
      const file = new File([data], d.name, { type: d.mime ?? data.type });
      const text = /\.pdf$/i.test(d.name) ? (await (await import('@/lib/pdfToHtml')).pdfFileToHtml(file)).text
        : /\.docx$/i.test(d.name) ? (await (await import('@/lib/docxToHtml')).docxFileToHtml(file)).text
        : /\.html?$/i.test(d.name) ? stripHtml(await file.text()) : await file.text();
      if (!text.trim()) throw new Error('No readable text');
      const budget = Math.floor(120_000 / Math.max(1, stored.length));
      // Cover/summary, important sections and final distribution notices.
      const excerpt = text.length <= budget ? text : text.slice(0, budget / 3) + '\n\n[… excerpt …]\n\n' + selectSections(text, Math.floor(budget / 3)) + '\n\n[… excerpt …]\n\n' + text.slice(-Math.floor(budget / 3));
      docs.push({ name: d.name, text: excerpt });
    } catch { failed.push(d.name); }
  }
  return { docs, failed };
}