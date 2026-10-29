/** App intake adapter; the vendored ICMA parser and dictionary stay untouched. */
import { E, ingestBDT, ingestText, validISIN } from '@/lib/termsheet/index.js';
import { P, fieldByPath, parseAmount, type BdtState } from '@/lib/bdt-bridge';
import { supabase } from '@/integrations/supabase/client';
import { getAiModel } from '@/lib/aiModel';

export interface DocumentProposal {
  kind: 'field' | 'group'; p?: string; g?: string;
  l: string; val: string; cur: string; src: string; payload?: unknown;
}
export const INITIAL_DOCUMENT_PATHS: string[] = [P.denomination, P.maturityDate, P.listingVenue, P.dayCount, P.couponFreq, P.seniority];
type Extraction = { text: string; keyTerms: Record<string, unknown>; bookrunners: unknown; ratings?: unknown };
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
    if (!text.trim() || name.endsWith('.xml')) return { text, keyTerms: {}, bookrunners: [], ratings: [] };
    const { data, error } = await supabase.functions.invoke('extract-deal-fields-ai', {
      body: { text: text.slice(0, 150000), model: getAiModel() },
    });
    if (error || data?.error) throw new Error('Document term lookup was unsuccessful');
    return { text, keyTerms: { ...(data?.keyTerms ?? {}), Ratings: data?.ratings ?? [] }, bookrunners: data?.bookrunners ?? [], ratings: data?.ratings ?? [] };
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
    const venues: [RegExp, string][] = [[/luxembourg/i, 'LUXEMBOURG_STOCK_EXCHANGE'], [/euronext dublin|irish stock exchange/i, 'EURONEXT_DUBLIN'], [/london stock exchange/i, 'LONDON_STOCK_EXCHANGE'], [/singapore|sgx/i, 'SINGAPORE_SGX'], [/nasdaq dubai/i, 'NASDAQ_DUBAI'], [/six swiss/i, 'SIX_SWISS_EXCHANGE'], [/hong kong/i, 'HONGKONG_STOCK_EXCHANGE'], [/frankfurt/i, 'FRANKFURT_STOCK_EXCHANGE'], [/vienna/i, 'VIENNA_STOCK_EXCHANGE']];
    return venues.find(([re]) => re.test(raw))?.[1] ?? '';
  }
  if (fd?.e && ['TefraCode', 'RegSCode', 'LegalTitleForm', 'Optionality', 'BusinessDayAdj'].includes(fd.e)) {
    const n = normalized.replace(/^(?:REG_?S_?)?(?:CATEGORY_?|CAT_?)?([123])$/, 'REGS_CAT$1').replace(/^TEFRA_?([CD])$/, 'TEFRA_$1');
    return options.includes(n) ? n : '';
  }
  if (path === P.seniority && /^senior(?: unsecured| secured| unsubordinated)?$/i.test(raw)) return 'SENIOR';
  return '';
};

function dateValue(raw: string) {
  // No year-only maturities, placeholders or ambiguous numeric dates.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) && !/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(raw) && !/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(raw)) return '';
  // Parse calendar parts directly — never via local-time Date, which shifts the day east of UTC.
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = (name: string) => {
    const lower = name.toLowerCase();
    const i = months.indexOf(lower.slice(0, 3));
    const full = new Date(Date.UTC(2000, i, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' }).toLowerCase();
    return i >= 0 && (lower.length === 3 || full.startsWith(lower) || (lower === 'sept' && i === 8)) ? i + 1 : 0;
  };
  let y: number, m: number, d: number;
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/))) [y, m, d] = [+match[3], month(match[2]), +match[1]];
  else if ((match = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/))) [y, m, d] = [+match[3], month(match[1]), +match[2]];
  else return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (!m || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
    ['Currency', P.currency, 'text'], ['Form of Note', P.legalTitleForm, 'enum'],
    ['TEFRA', TEFRA, 'enum'], ['Reg S Category', REGS, 'enum'],
    ['Optionality', P.optionality, 'enum'], ['Business Day Convention', P.bizDay, 'enum'],
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

const TEFRA = 'IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraCode';
const REGS = 'IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode';
const AGENCIES = ['FITCH', 'MOODYS', 'SNPG', 'DBRS', 'SCOPE'];
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const placeholder = (v: string) => !v || /\b(tbd|tba|to be|n\/a|pending)\b/i.test(v);

/** Identifiers actually printed in the document; invalid or generic values are dropped. */
export function extractedIdentifiers(terms: Record<string, unknown>): { Type: string; Value: string }[] {
  const out: { Type: string; Value: string }[] = [];
  const isin = str(terms.ISIN).toUpperCase().replace(/\s/g, '');
  const tmp = str(terms['Temporary ISIN']).toUpperCase().replace(/\s/g, '');
  const cusip = str(terms.CUSIP).toUpperCase().replace(/\s/g, '');
  const cc = str(terms['Common Code']).replace(/\s/g, '');
  if (validISIN(isin)) out.push({ Type: 'ISIN', Value: isin });
  if (validISIN(tmp) && tmp !== isin) out.push({ Type: 'TEMPORARY_ISIN', Value: tmp });
  if (/^[0-9A-Z]{8}\d$/.test(cusip) && /\d/.test(cusip.slice(0, 8))) out.push({ Type: 'CUSIP', Value: cusip });
  if (/^\d{9}$/.test(cc)) out.push({ Type: 'COMMON_CODE', Value: cc });
  return out;
}

/** Assigned agency ratings only; unknown agencies and placeholders are dropped. */
export function extractedRatings(terms: Record<string, unknown>): { RatingAgency: string; RatingValue: string; RatingOutlook: string }[] {
  const list = Array.isArray(terms.Ratings) ? terms.Ratings : [];
  const alias: Record<string, string> = { "MOODY'S": 'MOODYS', 'S&P': 'SNPG', SP: 'SNPG', 'STANDARD & POOR': 'SNPG', "STANDARD & POOR'S": 'SNPG' };
  return list.flatMap((r: any) => {
    const raw = str(r?.agency).toUpperCase();
    const agency = alias[raw] ?? raw;
    const value = str(r?.value);
    if (!AGENCIES.includes(agency) || placeholder(value) || !/^[A-Ca-c][A-Za-z0-9+-]{0,4}$/.test(value)) return [];
    const outlook = str(r?.outlook).toUpperCase();
    return [{ RatingAgency: agency, RatingValue: value, RatingOutlook: ['POSITIVE', 'NEGATIVE', 'STABLE', 'DEVELOPING'].includes(outlook) ? outlook : '' }];
  });
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
  const group = (g: string, l: string, val: string, payload: unknown, cur: unknown[]) => {
    const i = proposals.findIndex(p => p.kind === 'group' && p.g === g);
    if (i >= 0) proposals.splice(i, 1);
    if (JSON.stringify(payload) !== JSON.stringify(cur)) proposals.push({ kind: 'group', g, l, val, cur: `${cur.length} entries`, payload, src: source });
  };
  const ids = extractedIdentifiers(terms);
  if (ids.length) {
    const merged = [...(state.ids ?? []).filter(x => !ids.some(n => n.Type === x.Type)), ...ids];
    group('ids', 'Security identifiers list', ids.map(i => `${i.Type} ${i.Value}`).join(', '), merged, state.ids ?? []);
  }
  const ratings = extractedRatings(terms);
  if (ratings.length) group('ratings', 'Ratings list', ratings.map(r => `${r.RatingAgency} ${r.RatingValue}`).join(', '), ratings, state.ratings ?? []);
  const guarantor = str(terms.Guarantor);
  const parties = (state.parties ?? []) as any[];
  if (guarantor && !placeholder(guarantor) && !parties.some(p => (p.PartyName ?? '').toLowerCase() === guarantor.toLowerCase())) {
    const existing = proposals.find(p => p.kind === 'group' && p.g === 'parties');
    const base = existing ? (existing.payload as any[]) : JSON.parse(JSON.stringify(parties));
    const payload = [...base, { PartyName: guarantor, LEIIdentifier: '', BICIdentifier: '', CountryOfIncorporation: '', PartyType: '', Roles: ['GUARANTOR'], Ratings: [] }];
    if (existing) { existing.payload = payload; existing.val += `, guarantor ${guarantor}`; }
    else proposals.push({ kind: 'group', g: 'parties', l: 'Parties list', val: `add guarantor ${guarantor}`, cur: `${parties.length} entries`, payload, src: source });
  }
  return proposals;
}