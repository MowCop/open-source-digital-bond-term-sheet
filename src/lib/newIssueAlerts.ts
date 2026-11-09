import { termSheetView } from '@/lib/termSheetView';
import type { BdtState } from '@/lib/bdt-bridge';

/**
 * New-issue email alerts: pure helpers shared by the Bond Console, the live
 * bulletin and the Send update dialog. Terms always come from the SAVED BDT
 * state; user intro/notes are separate inputs and are never regenerated.
 */

// ── distribution addresses ───────────────────────────────────────────────────
const EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const DISTRIBUTION_HINT = 'Use desk or distribution-list addresses, not individuals.';

export function isValidDistributionEmail(raw: string): boolean {
  const s = raw.trim();
  return s.length <= 254 && EMAIL.test(s);
}

/** Splits on commas/semicolons/whitespace, lowercases, de-duplicates. */
export function parseAddresses(raw: string | string[]): { addresses: string[]; invalid: string[] } {
  const parts = (Array.isArray(raw) ? raw : raw.split(/[\s,;]+/)).map(s => s.trim()).filter(Boolean);
  const addresses: string[] = [], invalid: string[] = [];
  for (const p of parts) {
    if (!isValidDistributionEmail(p)) { invalid.push(p); continue; }
    const v = p.toLowerCase();
    if (!addresses.includes(v)) addresses.push(v);
  }
  return { addresses, invalid };
}

export interface DistributionRow { vendor_id: string; vendor_name: string; addresses: string[]; enabled: boolean }

/** Enabled vendors with at least one valid address; one recipient per address. */
export function selectRecipients(rows: DistributionRow[]) {
  return rows.filter(r => r.enabled).flatMap(r => parseAddresses(r.addresses).addresses.map(address => ({ vendorId: r.vendor_id, vendorName: r.vendor_name, address })));
}

// ── lifecycle events and subject ─────────────────────────────────────────────
export const ALERT_EVENTS = [
  { id: 'mandate', label: 'Mandate', suffix: 'Mandate announcement' },
  { id: 'ipt', label: 'Announced / IPT', suffix: 'IPTs' },
  { id: 'guidance', label: 'Guidance', suffix: 'Guidance' },
  { id: 'books', label: 'Books update', suffix: 'Books update' },
  { id: 'launch', label: 'Launch', suffix: 'Launched' },
  { id: 'pricing', label: 'Pricing', suffix: 'Priced' },
  { id: 'final', label: 'Final terms', suffix: 'Final terms' },
] as const;
export type AlertEvent = typeof ALERT_EVENTS[number]['id'];

const STAGE_EVENT: Record<string, AlertEvent> = {
  Mandate: 'mandate', Announced: 'ipt', Launched: 'launch', 'Books Open': 'books', 'Books Closed': 'books', Priced: 'pricing', Settled: 'final',
};
export const eventForStage = (stage: string): AlertEvent => STAGE_EVENT[stage] ?? 'mandate';

function tenorOf(v: ReturnType<typeof termSheetView>, fallback = '') {
  const start = v.issueDate || v.settlementDate, end = v.maturityDate;
  if (start && end) {
    const y = Math.round(((new Date(end).getTime() - new Date(start).getTime()) / (365.25 * 864e5)) * 2) / 2;
    if (y > 0) return `${y}Y`;
  }
  return fallback;
}

/** "ISSUER – CCY SIZE TENOR – IPTs T+200bp area" (detail optional). */
export function buildSubject(state: BdtState, event: AlertEvent, detail = '', tenorFallback = ''): string {
  const v = termSheetView(state);
  const head = (v.issuerName || 'Issuer').toUpperCase();
  const deal = [v.currency, v.size, tenorOf(v, tenorFallback)].filter(Boolean).join(' ');
  const suffix = ALERT_EVENTS.find(e => e.id === event)?.suffix ?? '';
  return [head, deal, [suffix, detail.trim()].filter(Boolean).join(' ')].filter(Boolean).join(' – ');
}

// ── terms block, diff, hash ──────────────────────────────────────────────────
export const TERM_LABELS: [keyof ReturnType<typeof termSheetView>, string][] = [
  ['issuerName', 'Issuer'], ['issuerLEI', 'Issuer LEI'], ['issuerRating', 'Ratings'], ['issuanceType', 'Issuance type'],
  ['currency', 'Currency'], ['size', 'Size'], ['specifiedDenomination', 'Denomination'], ['coupon', 'Coupon'],
  ['issuePrice', 'Issue price'], ['reofferPrice', 'Re-offer price'], ['reofferYield', 'Re-offer yield'], ['reofferSpread', 'Re-offer spread'],
  ['midSwapRate', 'Mid-swap'], ['benchmark', 'Benchmark'], ['pricingDate', 'Pricing date'], ['issueDate', 'Issue date'],
  ['settlementDate', 'Settlement date'], ['maturityDate', 'Maturity'], ['governingLaw', 'Governing law'],
  ['sellingRestrictions', 'Selling restrictions'], ['listingVenue', 'Listing'], ['isin', 'ISIN'],
];

export function termRows(state: BdtState | null | undefined): { key: string; label: string; value: string }[] {
  if (!state?.f) return [];
  const v = termSheetView(state) as Record<string, unknown>;
  const rows = TERM_LABELS.map(([k, label]) => {
    const raw = v[k as string];
    const value = Array.isArray(raw) ? raw.join(', ') : String(raw ?? '').trim();
    return { key: k as string, label, value };
  }).filter(r => r.value);
  const br = termSheetView(state).bookrunners;
  if (br.length) rows.splice(3, 0, { key: 'bookrunners', label: 'Bookrunners', value: br.join(', ') });
  return rows;
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paras = (s: string) => s.trim() ? s.trim().split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('') : '';

/** Deterministic bulletin: user intro, terms from saved state, user notes, then legal notices verbatim (outside AI). */
export function renderBulletin(args: { state: BdtState | null | undefined; intro: string; notes: string; legalNotices?: string[] }): string {
  const rows = termRows(args.state);
  const table = rows.length ? `<h3>Digital Term Sheet</h3><table>${rows.map(r => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`).join('')}</table>` : '<p><em>No saved terms yet.</em></p>';
  const legal = (args.legalNotices ?? []).filter(p => p.trim());
  return paras(args.intro) + table + paras(args.notes) + (legal.length ? '<h3>Legal Notices</h3>' + legal.map(p => `<p>${escapeHtml(p)}</p>`).join('') : '');
}

export function termsDiff(before: BdtState | null | undefined, after: BdtState | null | undefined) {
  const a = new Map(termRows(before).map(r => [r.key, r])), b = new Map(termRows(after).map(r => [r.key, r]));
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  return keys.map(k => ({ key: k, label: (b.get(k) ?? a.get(k))!.label, before: a.get(k)?.value ?? '', after: b.get(k)?.value ?? '' })).filter(d => d.before !== d.after);
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
/** Hash of recorded terms only (mirrors supabase/functions/_shared/alert-terms.ts). */
export function termsHash(state: unknown): string {
  const s = (state && typeof state === 'object' ? state : {}) as Record<string, unknown>;
  const text = stable({ stage: s.stage ?? null, f: s.f ?? {}, parties: s.parties ?? [], ids: s.ids ?? [], ratings: s.ratings ?? [], contacts: s.contacts ?? [] });
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0') + ':' + text.length;
}

// ── send request (human approval required) ───────────────────────────────────
export interface SendRequestInput {
  approved: boolean; dealId: string; event: AlertEvent; subject: string; bodyHtml: string;
  releaseId: string | null; state: BdtState; xml: string; bcc?: string;
}
export function buildSendRequest(i: SendRequestInput) {
  if (i.approved !== true) throw new Error('A person must preview and approve this send.');
  if (!i.subject.trim()) throw new Error('Subject is required.');
  if (!i.releaseId) throw new Error('Save the term sheet before sending.');
  const bcc = i.bcc?.trim() ?? '';
  if (bcc && !isValidDistributionEmail(bcc)) throw new Error('BCC address is not a valid email.');
  return { action: 'send' as const, approved: true as const, dealId: i.dealId, event: i.event, subject: i.subject.trim(), bodyHtml: i.bodyHtml, releaseId: i.releaseId, bdtHash: termsHash(i.state), xml: i.xml, bcc: bcc || undefined };
}
