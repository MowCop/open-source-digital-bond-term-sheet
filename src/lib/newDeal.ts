import { getAiModel } from '@/lib/aiModel';
import { supabase } from '@/integrations/supabase/client';

export const emptyNewDeal = () => ({
  issuerName: '', currency: '', size: '', tenor: '', coupon: '',
  issuerRating: '', issuanceType: '', governingLaw: '',
});

export function canCreateNewDeal(issuerName: string, bookrunners: { name: string }[]) {
  return issuerName.trim().length > 0 && bookrunners.some(br => br.name.trim().length > 0);
}

export function fillEmptyIssuer(current: string, extracted: unknown): string {
  return current.trim() || typeof extracted !== 'string' ? current : extracted.trim();
}

export type NewDealDraft = ReturnType<typeof emptyNewDeal>;
export type NewDealBookrunner = { name: string; role: 'active' | 'passive'; isGlobalCoordinator: boolean };
export type NewDealExtraction = { draft: Partial<NewDealDraft>; bookrunners: NewDealBookrunner[] };

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];
const LAWS: Record<string, string> = { english: 'ENGLISH_LAW', 'new york': 'NEW_YORK_LAW', german: 'GERMAN_LAW', french: 'FRENCH_LAW', swiss: 'SWISS_LAW' };

/** Map extracted key terms onto the New Deal form vocabulary; unknown values stay empty. */
export function mapExtractedTerms(keyTerms: Record<string, unknown> = {}, bookrunners: unknown = []): NewDealExtraction {
  const t = (k: string) => (typeof keyTerms[k] === 'string' ? (keyTerms[k] as string).trim() : '');
  const ccy = t('Currency').toUpperCase();
  const lawText = t('Governing Law').toLowerCase();
  const law = Object.keys(LAWS).find(k => lawText.includes(k));
  const coupon = t('Coupon');
  return {
    draft: {
      issuerName: t('Issuer Name'),
      currency: CURRENCIES.includes(ccy) ? ccy : '',
      size: t('Size'),
      tenor: t('Tenor'),
      coupon: /^tbd$/i.test(coupon) ? '' : coupon,
      issuerRating: t('Issuer Rating'),
      governingLaw: law ? LAWS[law] : '',
    },
    bookrunners: (Array.isArray(bookrunners) ? bookrunners : [])
      .filter((b: any) => b && typeof b.name === 'string' && b.name.trim())
      .map((b: any) => ({ name: b.name.trim(), role: b.role === 'passive' ? 'passive' : 'active', isGlobalCoordinator: !!b.isGlobalCoordinator })),
  };
}

/** Fill only empty fields; anything the user typed is kept. Returns the merged draft and the filled field names. */
export function mergeNewDealDraft(current: NewDealDraft, extracted: Partial<NewDealDraft>, locked: Set<string> = new Set()) {
  const next = { ...current };
  const filled: string[] = [];
  for (const [k, v] of Object.entries(extracted) as [keyof NewDealDraft, string][]) {
    if (v && !current[k].trim() && !locked.has(k)) { next[k] = v; filled.push(k); }
  }
  return { draft: next, filled };
}

/** Add extracted bookrunners only when the user has not added any. */
export function mergeNewDealBookrunners<T extends { name: string }>(current: T[], extracted: T[]): T[] {
  return current.length ? current : extracted;
}

/** Reuse existing document readers and extraction service to pre-fill the New Deal form. */
export async function extractNewDealTerms(file: File): Promise<NewDealExtraction> {
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith('.pdf')) {
    const { pdfFileToHtml } = await import('@/lib/pdfToHtml');
    text = (await pdfFileToHtml(file)).text;
  } else if (name.endsWith('.docx')) {
    const { docxFileToHtml } = await import('@/lib/docxToHtml');
    text = (await docxFileToHtml(file)).text;
  } else if (name.endsWith('.xml')) {
    const doc = new DOMParser().parseFromString(await file.text(), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('The XML file could not be read');
    const nodes = Array.from(doc.getElementsByTagName('*'));
    const issuer = nodes.filter(n => n.localName === 'Party').find(p =>
      Array.from(p.getElementsByTagName('*')).some(n => n.localName === 'PartyRoleType' && n.textContent?.trim() === 'ISSUER'));
    const issuerName = issuer && Array.from(issuer.getElementsByTagName('*')).find(n => n.localName === 'PartyName')?.textContent?.trim();
    if (issuerName) return { draft: { issuerName }, bookrunners: [] };
    text = doc.documentElement.textContent ?? '';
  } else if (/\.html?$/.test(name)) {
    const { stripHtml } = await import('@/lib/htmlText');
    text = stripHtml(await file.text());
  } else {
    text = await file.text();
  }
  if (!text.trim()) return { draft: {}, bookrunners: [] };
  const { data, error } = await supabase.functions.invoke('extract-deal-fields-ai', {
    body: { text: text.slice(0, 150000), model: getAiModel() },
  });
  if (error || data?.error) throw new Error('Term lookup was unsuccessful');
  return mapExtractedTerms(data?.keyTerms, data?.bookrunners);
}