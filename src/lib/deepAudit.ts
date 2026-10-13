/**
 * AI Deep Audit: on-demand Claude comparison of the live Fill fields against the
 * deal's stored documents. Findings are always warnings and never auto-applied.
 */
import { supabase } from '@/integrations/supabase/client';
import { FIELDS } from '@/lib/termsheet/index.js';
import type { BdtState } from '@/lib/bdt-bridge';
import { listDealDocuments } from '@/lib/dealDocuments';
import { getAiModel } from '@/lib/aiModel';

export interface AuditFinding {
  title: string; detail: string; fieldPath: string;
  currentValue: string; docValue: string; docQuote: string;
}
export interface AuditRun { at: string; model: string; findings: AuditFinding[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F = FIELDS as any[];
const KEY = (id: string) => `vdr.deepAudit.${id}`;

export function loadAudit(dealId: string): AuditRun | null {
  try { return JSON.parse(localStorage.getItem(KEY(dealId)) ?? 'null'); } catch { return null; }
}
export function saveAudit(dealId: string, run: AuditRun) { localStorage.setItem(KEY(dealId), JSON.stringify(run)); }

/** Field list sent to the model: every dictionary field with its live value. */
export function auditFields(state: BdtState) {
  return F.filter(f => f.t !== 'group' && f.p).map(f => ({ path: f.p as string, label: String(f.l), value: String(state.f[f.p] ?? '') }));
}

const SECTION = /terms and conditions|use of proceeds|green|social|sustainab|framework|redemption|dissolution|call|step[- ]?up|final terms|pricing supplement|coupon|profit rate|periodic distribution|maturity|denomination|governing law|issue price|rating|listing|isin|common code|change of control|event of default/i;

/** Keeps documents under ~40k chars by taking windows around high-value sections. */
export function selectSections(text: string, max = 40_000): string {
  const clean = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  if (clean.length <= max) return clean;
  const paras = clean.split(/\n\s*\n/);
  const keep = new Set<number>();
  paras.forEach((p, i) => { if (SECTION.test(p.slice(0, 400))) { keep.add(i); keep.add(i + 1); } });
  let out = '';
  for (const i of [...keep].sort((a, b) => a - b)) {
    const p = paras[i]; if (!p) continue;
    if (out.length + p.length > max) break;
    out += p + '\n\n';
  }
  return out || clean.slice(0, max);
}

async function docText(path: string, name: string, mime: string | null): Promise<string> {
  const { data, error } = await supabase.storage.from('deal-documents').download(path);
  if (error || !data) throw error ?? new Error('download failed');
  const file = new File([data], name, { type: mime ?? data.type });
  if (/pdf/i.test(file.type) || /\.pdf$/i.test(name)) return (await (await import('@/lib/pdfToHtml')).pdfFileToHtml(file)).text;
  if (/\.docx$/i.test(name)) return (await (await import('@/lib/docxToHtml')).docxFileToHtml(file)).text;
  return file.text();
}

export async function runDeepAudit(dealId: string, state: BdtState, onStep?: (s: string) => void): Promise<AuditRun> {
  const stored = (await listDealDocuments(dealId)).slice(0, 6);
  if (!stored.length) throw new Error('No deal documents stored');
  const docs: { name: string; text: string }[] = [];
  for (const d of stored) {
    onStep?.(`Reading ${d.name}…`);
    try { const t = selectSections(await docText(d.path, d.name, d.mime), Math.floor(150_000 / stored.length)); if (t.trim()) docs.push({ name: d.name, text: t }); }
    catch { /* unreadable file: skip */ }
  }
  if (!docs.length) throw new Error('None of the stored documents could be read');
  const model = getAiModel();
  onStep?.('Comparing documents against term sheet fields…');
  const { data, error } = await supabase.functions.invoke('audit-deal-fields-ai', { body: { fields: auditFields(state), docs, model } });
  if (error) {
    let msg = error.message;
    try { const b = await (error as { context?: Response }).context?.json(); msg = b?.message || msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  const run: AuditRun = { at: new Date().toISOString(), model, findings: (data?.findings ?? []) as AuditFinding[] };
  saveAudit(dealId, run);
  return run;
}
