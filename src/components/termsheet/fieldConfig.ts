import type { Deal, DealStage } from '@/types/bond';

export const TS_STAGES: DealStage[] = ['Mandate', 'Announced', 'Launched', 'Books Open', 'Books Closed', 'Priced', 'Settled'];
export const stageIndex = (s: DealStage) => Math.max(0, TS_STAGES.indexOf(s));

export type FieldType = 'text' | 'select' | 'date';
export type Layer = 'key' | 'pricing' | 'more';

export interface TSField {
  key: keyof Deal;
  label: string;
  type: FieldType;
  layer: Layer;
  group?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Stage from which the field must be filled */
  requiredAt?: DealStage;
  /** AI extraction keyTerms name */
  aiKey?: string;
}

const opts = (vals: string[]) => vals.map(v => ({ value: v, label: v.replace(/_/g, ' ').replace('30E 360', '30E/360').replace('30 360', '30/360') }));

export const LAYERS: { id: Layer; title: string; note: string; opensAt: DealStage }[] = [
  { id: 'key', title: 'Key Terms', note: 'The fields every execution message needs.', opensAt: 'Mandate' },
  { id: 'pricing', title: 'Pricing & Execution', note: 'Guidance, reoffer levels and benchmarks. Required from pricing.', opensAt: 'Launched' },
  { id: 'more', title: 'More Detail', note: 'Issuer, form, interest, legal and labels.', opensAt: 'Settled' },
];

// Coupon type / Coupon / bookrunners are rendered as bespoke controls in the Key layer.
export const FIELDS: TSField[] = [
  // ---- Key terms ----
  { key: 'issuerName', label: 'Issuer name', type: 'text', layer: 'key', requiredAt: 'Mandate', aiKey: 'Issuer Name' },
  { key: 'currency', label: 'Currency', type: 'select', layer: 'key', requiredAt: 'Mandate', options: opts(['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD', 'SEK', 'NOK']), aiKey: 'Currency' },
  { key: 'size', label: 'Size', type: 'text', layer: 'key', requiredAt: 'Announced', placeholder: 'e.g. 1bn, 500m WNG', aiKey: 'Size' },
  { key: 'tenor', label: 'Tenor', type: 'text', layer: 'key', requiredAt: 'Mandate', placeholder: 'e.g. 7Y', aiKey: 'Tenor' },
  { key: 'maturityDate', label: 'Maturity date', type: 'date', layer: 'key', requiredAt: 'Launched', aiKey: 'Maturity Date' },
  { key: 'issueDate', label: 'Date of issue', type: 'date', layer: 'key', requiredAt: 'Launched' },
  { key: 'pricingDate', label: 'Pricing date', type: 'date', layer: 'key', requiredAt: 'Launched', aiKey: 'Pricing Date' },
  { key: 'settlementDate', label: 'Settlement date', type: 'date', layer: 'key', requiredAt: 'Priced', aiKey: 'Settlement Date' },
  { key: 'isin', label: 'ISIN', type: 'text', layer: 'key', requiredAt: 'Priced', placeholder: '12 characters', aiKey: 'ISIN' },

  // ---- Pricing & execution ----
  { key: 'ipt', label: 'IPT', type: 'text', layer: 'pricing', requiredAt: 'Launched', placeholder: 'e.g. MS+75 area' },
  { key: 'guidance', label: 'Guidance', type: 'text', layer: 'pricing', requiredAt: 'Books Open', placeholder: 'e.g. MS+65 (+/-3) WPIR' },
  { key: 'benchmark', label: 'Benchmark', type: 'text', layer: 'pricing', placeholder: 'e.g. MS, UST 4.25% 2034' },
  { key: 'reofferSpread', label: 'Reoffer spread', type: 'text', layer: 'pricing', requiredAt: 'Priced', aiKey: 'Reoffer Spread' },
  { key: 'reofferYield', label: 'Reoffer yield', type: 'text', layer: 'pricing', requiredAt: 'Priced', aiKey: 'Reoffer Yield' },
  { key: 'reofferPrice', label: 'Reoffer price', type: 'text', layer: 'pricing', requiredAt: 'Priced', aiKey: 'Reoffer Price' },
  { key: 'issuePrice', label: 'Issue price', type: 'text', layer: 'pricing', requiredAt: 'Priced', aiKey: 'Issue Price' },
  { key: 'midSwapRate', label: 'Mid-swap rate', type: 'text', layer: 'pricing', aiKey: 'Mid-Swap Rate' },
  { key: 'specifiedDenomination', label: 'Denomination', type: 'text', layer: 'pricing', placeholder: 'e.g. EUR 100k x 1k', aiKey: 'Denomination' },

  // ---- More detail ----
  { key: 'issuerLEI', label: 'LEI', type: 'text', layer: 'more', group: 'Issuer & ratings', aiKey: 'LEI' },
  { key: 'issuerRating', label: 'Issuer rating', type: 'text', layer: 'more', group: 'Issuer & ratings', aiKey: 'Issuer Rating' },
  { key: 'ratingOutlook', label: 'Outlook', type: 'text', layer: 'more', group: 'Issuer & ratings' },
  { key: 'issuanceType', label: 'Issuance type', type: 'select', layer: 'more', group: 'Form & status', options: opts(['STANDALONE', 'PROGRAMME']) },
  { key: 'formOfNote', label: 'Form of note', type: 'select', layer: 'more', group: 'Form & status', options: opts(['BEARER_GLOBAL', 'REGISTERED', 'DEMATERIALISED']) },
  { key: 'statusOfNote', label: 'Status / ranking', type: 'select', layer: 'more', group: 'Form & status', options: opts(['SENIOR_UNSECURED', 'SENIOR_SECURED', 'SUBORDINATED', 'JUNIOR_SUBORDINATED', 'COVERED']) },
  { key: 'cusip', label: 'CUSIP', type: 'text', layer: 'more', group: 'Form & status' },
  { key: 'commonCode', label: 'Common code', type: 'text', layer: 'more', group: 'Form & status' },
  { key: 'interestPaymentFrequency', label: 'Payment frequency', type: 'select', layer: 'more', group: 'Interest details', options: opts(['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY']) },
  { key: 'dayCountFraction', label: 'Day count', type: 'select', layer: 'more', group: 'Interest details', options: opts(['ACT_ACT', 'ACT_360', 'ACT_365', '30_360', '30E_360']) },
  { key: 'businessDayConvention', label: 'Business day conv.', type: 'select', layer: 'more', group: 'Interest details', options: opts(['MODIFIED_FOLLOWING', 'FOLLOWING', 'PRECEDING']) },
  { key: 'optionality', label: 'Optionality', type: 'text', layer: 'more', group: 'Interest details', placeholder: 'e.g. Make-whole call' },
  { key: 'listingVenue', label: 'Listing venue', type: 'text', layer: 'more', group: 'Listing & legal', aiKey: 'Listing' },
  { key: 'governingLaw', label: 'Governing law', type: 'select', layer: 'more', group: 'Listing & legal', options: opts(['ENGLISH_LAW', 'FRENCH_LAW', 'GERMAN_LAW', 'NEW_YORK_LAW', 'SWISS_LAW']) },
  { key: 'sellingRestrictions', label: 'Selling restrictions', type: 'text', layer: 'more', group: 'Selling restrictions', placeholder: 'e.g. Reg S Cat 2, TEFRA D' },
  { key: 'taxonomy', label: 'ESG / label', type: 'text', layer: 'more', group: 'ESG / label', placeholder: 'e.g. Green' },
];

export const isFilled = (v: unknown) => typeof v === 'string' ? v.trim() !== '' && v.trim().toUpperCase() !== 'TBD' && v.trim().toUpperCase() !== 'TBA' : v != null;

export const isRequiredNow = (f: { requiredAt?: DealStage }, stage: DealStage) =>
  !!f.requiredAt && stageIndex(stage) >= stageIndex(f.requiredAt);

/** Map AI "keyTerms" values to Deal fields (normalising enums where needed). */
export function aiToDealPatch(keyTerms: Record<string, string>): Partial<Deal> {
  const out: Record<string, string> = {};
  for (const f of FIELDS) {
    if (f.aiKey && keyTerms[f.aiKey]?.trim()) out[f.key as string] = keyTerms[f.aiKey].trim();
  }
  const c = keyTerms['Coupon']?.trim(); if (c) out.coupon = c;
  const it = keyTerms['Interest Type']?.toLowerCase() || '';
  if (it.includes('float') || it.includes('frn')) out.interestType = 'FLOATING';
  else if (it.includes('zero')) out.interestType = 'ZERO_COUPON';
  else if (it.includes('fix')) out.interestType = 'FIXED';
  const gl = keyTerms['Governing Law']?.toLowerCase() || '';
  const glMap: Record<string, string> = { english: 'ENGLISH_LAW', 'new york': 'NEW_YORK_LAW', german: 'GERMAN_LAW', french: 'FRENCH_LAW', swiss: 'SWISS_LAW' };
  delete out.governingLaw;
  for (const [k, v] of Object.entries(glMap)) if (gl.includes(k)) out.governingLaw = v;
  const dc = (keyTerms['Day Count'] || '').toUpperCase().replace('/', '_');
  if (['ACT_ACT', 'ACT_360', 'ACT_365', '30_360', '30E_360'].includes(dc)) out.dayCountFraction = dc;
  return out as Partial<Deal>;
}

/** Tenor like "7Y" + issue/settlement date -> suggested maturity (YYYY-MM-DD). */
export function suggestMaturity(tenor?: string, from?: string): string | null {
  const m = tenor?.match(/(\d+(?:\.\d+)?)\s*Y/i);
  if (!m || !from) return null;
  const d = new Date(from);
  if (isNaN(d.getTime())) return null;
  const years = parseFloat(m[1]);
  d.setMonth(d.getMonth() + Math.round(years * 12));
  return d.toISOString().slice(0, 10);
}

export function suggestTenor(maturity?: string, from?: string): string | null {
  if (!maturity || !from) return null;
  const a = new Date(from), b = new Date(maturity);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return null;
  const years = (b.getTime() - a.getTime()) / (365.25 * 864e5);
  return `${Math.round(years)}Y`;
}
