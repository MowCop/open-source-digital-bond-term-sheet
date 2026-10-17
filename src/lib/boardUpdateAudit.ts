import type { Attachment } from '@/types/bond';
import type { AuditFinding } from '@/lib/deepAudit';
import { selectSections } from '@/lib/deepAudit';
import { stripHtml } from '@/lib/htmlText';
import { getAiModel } from '@/lib/aiModel';
import { supabase } from '@/integrations/supabase/client';
export interface BoardAuditResult { findings: AuditFinding[]; read: string[]; failed: string[] }
export async function readBoardAttachment(a: Attachment): Promise<string> {
  let file = a.file;
  if (!file) {
    if (!a.url) throw new Error('Missing attachment');
    const response = await fetch(a.url);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    file = new File([blob], a.name, { type: a.mimeType || blob.type });
  }
  if (/\.pdf$/i.test(a.name)) {
    if (!(await file.slice(0, 5).text()).startsWith('%PDF-')) throw new Error('Not a PDF');
    return (await (await import('@/lib/pdfToHtml')).pdfFileToHtml(file)).text;
  }
  if (/\.docx$/i.test(a.name)) return (await (await import('@/lib/docxToHtml')).docxFileToHtml(file)).text;
  throw new Error('Unsupported document format');
}
export async function auditBoardUpdate(text: string, attachments: Attachment[], onStep?: (step: string) => void, readAttachment = readBoardAttachment): Promise<BoardAuditResult> {
  const message = stripHtml(text).trim();
  if (!message) throw new Error('This update has no message text to check.');
  if (message.length > 100_000) throw new Error('This update is too long to check in one request.');
  const docs: { name: string; text: string }[] = [], failed: string[] = [];
  const budget = Math.min(100_000, Math.floor(150_000 / Math.max(1, attachments.length)));
  for (const a of attachments) {
    onStep?.(`Reading ${a.name}…`);
    try {
      const text = selectSections(await readAttachment(a), budget);
      if (!text.trim()) throw new Error('No readable text');
      docs.push({ name: a.name, text });
    } catch { failed.push(a.name); }
  }
  onStep?.('Checking update wording and attached documents…');
  const { data, error } = await supabase.functions.invoke('audit-deal-fields-ai', { body: { scope: 'board_update', fields: [], message, docs, model: getAiModel() } });
  if (error) {
    let message = error.message;
    try { const body = await (error as { context?: Response }).context?.json(); message = body?.message || message; } catch { /* keep safe error */ }
    throw new Error(message);
  }
  if (!Array.isArray(data?.findings)) throw new Error('The audit returned no valid results. Please start a new check.');
  return { findings: data.findings, read: docs.map(d => d.name), failed };
}
