/** App intake adapter; the vendored ICMA parser and dictionary stay untouched. */
import { E, ingestBDT, ingestText } from '@/lib/termsheet/index.js';
import { P, fieldByPath, parseAmount, type BdtState } from '@/lib/bdt-bridge';
import { supabase } from '@/integrations/supabase/client';
import { getAiModel } from '@/lib/aiModel';

export interface DocumentProposal {
  kind: 'field' | 'group'; p?: string; g?: string;
  l: string; val: string; cur: string; src: string; payload?: unknown;
}
export const INITIAL_DOCUMENT_PATHS: string[] = [P.denomination, P.maturityDate, P.listingVenue, P.dayCount, P.couponFreq, P.seniority];
type Extraction = { text: string; keyTerms: Record<string, unknown>; bookrunners: unknown };
const cache = new WeakMap<File, Promise<Extraction>>();

export function readDocumentTerms(file: File): Promise<Extraction> {
  const previous = cache.get(file);
  if (previous) return previous;
  const result = (async () => {
    const name = file.name.toLowerCase();
    let text = '';
    if (name.endsWith('.pdf')) text = (await (await import('@/lib/pdfToHtml')).pdfFileToHtml(file)).text;
    else if (name.endsWith('.docx')) text = (await (await import('@/lib/docxToHtml')).docxFileToHtml(file)).text;
    else if (/\.html?$/.test(name)) text = (await import('@/lib/htmlText')).stripHtml(await file.text());
    else text = await file.text();
    if (!text.trim() || name.endsWith('.xml')) return { text, keyTerms: {}, bookrunners: [] };
    const { data, error } = await supabase.functions.invoke('extract-deal-fields-ai', {
      body: { text: text.slice(0, 150000), model: getAiModel() },
    });
    if (error || data?.error) throw new Error('Document term lookup was unsuccessful');
    return { text, keyTerms: data?.keyTerms ?? {}, bookrunners: data?.bookrunners ?? [] };
  })();
  cache.set(file, result);
  result.catch(() => cache.delete(file));
  return result;
}

const enumValue = (path: string, raw: string) => {
  const fd = fieldByPath(path);
  const options: string[] = fd?.e ? (E as Record<string, string[]>)[fd.e] ?? [] : [];
  const normalized = raw.toUpperCase().replace(/[-\s]+/g, '_');
  if (options.includes(normalized)) return normalized;
  if (path === P.couponFreq) {
    const aliases: Record<string, string> = { ANNUAL: 'ANNUALLY', SEMI_ANNUAL: 'SEMIANNUALLY', SEMIANNUAL: 'SEMIANNUALLY', 'TWICE_A_YEAR': 'SEMIANNUALLY', QUARTERLY: 'QUARTERLY', MONTHLY: 'MONTHLY', AT_MATURITY: 'ATMATURITY' };
    return aliases[normalized] ?? '';
  }
  if (path === P.dayCount) {
    const day = raw.replace(/actual/ig, 'ACT').toUpperCase().replace(/\s/g, '');
    const aliases: Record<string, string> = { 'ACT/ACT(ICMA)': 'ICMA_ACT/ACT', 'ACT/ACT(ISDA)': 'ISDA_ACT/ACT' };
    return options.includes(day) ? day : aliases[day] ?? '';
  }
  if (path === P.listingVenue) {
    const venues: [RegExp, string][] = [[/luxembourg/i, 'LUXEMBOURG_STOCK_EXCHANGE'], [/euronext dublin|irish stock exchange/i, 'EURONEXT_DUBLIN'], [/london stock exchange/i, 'LONDON_STOCK_EXCHANGE'], [/singapore|sgx/i, 'SINGAPORE_SGX'], [/nasdaq dubai/i, 'NASDAQ_DUBAI'], [/six swiss/i, 'SIX_SWISS_EXCHANGE'], [/hong kong/i, 'HONGKONG_STOCK_EXCHANGE'], [/frankfurt/i, 'FRANKFURT_STOCK_EXCHANGE']];
    return venues.find(([re]) => re.test(raw))?.[1] ?? '';
  }
  if (path === P.seniority && /^senior(?: unsecured| secured| unsubordinated)?$/i.test(raw)) return 'SENIOR';
  return '';
};

function dateValue(raw: string) {
  // No year-only maturities, placeholders or ambiguous numeric dates.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) && !/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(raw) && !/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(raw)) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const iso = date.toISOString().slice(0, 10);
  return /^\d{4}-/.test(raw) && iso !== raw ? '' : iso;
}

export function extractedFieldValues(terms: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  const mappings: [string, string, 'number' | 'date' | 'enum' | 'text'][] = [
    ['Denomination', P.denomination, 'number'], ['Maturity Date', P.maturityDate, 'date'],
    ['Listing', P.listingVenue, 'enum'], ['Day Count', P.dayCount, 'enum'],
    ['Payment Frequency', P.couponFreq, 'enum'], ['Seniority', P.seniority, 'enum'],
    ['Interest Type', P.interestType, 'enum'], ['Coupon', P.coupon, 'number'],
    ['Issue Price', P.issuePrice, 'number'], ['Reoffer Price', P.reofferPrice, 'number'],
    ['Reoffer Yield', P.reofferYield, 'number'], ['Pricing Date', P.pricingDate, 'date'],
    ['Settlement Date', P.settlementDate, 'date'], ['Size', P.totalAmount, 'number'],
    ['Currency', P.currency, 'text'],
  ];
  for (const [key, path, kind] of mappings) {
    const raw = typeof terms[key] === 'string' ? (terms[key] as string).trim() : '';
    if (!raw || /\b(tbd|tba|to be determined|benchmark)\b/i.test(raw)) continue;
    let value = kind === 'enum' ? enumValue(path, raw) : kind === 'date' ? dateValue(raw) : raw;
    if (kind === 'number') {
      const n = parseAmount(raw);
      value = Number.isFinite(n) && n >= 0 ? String(n) : '';
    }
    if (path === P.currency && !/^[A-Z]{3}$/.test(value)) value = '';
    if (value) result[path] = value;
  }
  return result;
}

export function documentProposals(state: BdtState, text: string, terms: Record<string, unknown>, source: string, xml = false): DocumentProposal[] {
  const base = xml ? ingestBDT(state, text, source) : ingestText(state, text, source);
  const proposals: DocumentProposal[] = Array.isArray(base) ? base : [];
  if (xml) return proposals;
  for (const [path, value] of Object.entries(extractedFieldValues(terms))) {
    const fd = fieldByPath(path);
    if (!fd) continue;
    const index = proposals.findIndex(p => p.p === path);
    if (index >= 0) proposals.splice(index, 1);
    if ((state.f[path] ?? '').trim() !== value) proposals.push({ kind: 'field', p: path, l: fd.l, val: value, cur: state.f[path] ?? '', src: source });
  }
  return proposals;
}