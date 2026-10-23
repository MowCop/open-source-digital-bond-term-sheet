import { readDocumentTerms, documentProposals, INITIAL_DOCUMENT_PATHS } from '@/lib/documentIntake';
import { emptyState } from '@/lib/termsheet/index.js';
import type { BdtState } from '@/lib/bdt-bridge';

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
export type NewDealExtraction = { draft: Partial<NewDealDraft>; bookrunners: NewDealBookrunner[]; fields?: Record<string, string> };

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];
const LAWS: Record<string, string> = { english: 'ENGLISH_LAW', 'new york': 'NEW_YORK_LAW', german: 'GERMAN_LAW', french: 'FRENCH_LAW' };

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
  const { text, keyTerms, bookrunners } = await readDocumentTerms(file);
  const proposals = documentProposals(emptyState() as BdtState, text, keyTerms, file.name, file.name.toLowerCase().endsWith('.xml'));
  const fields = Object.fromEntries(proposals.filter(p => p.p && INITIAL_DOCUMENT_PATHS.includes(p.p)).map(p => [p.p, p.val]));
  const mapped = mapExtractedTerms(keyTerms, bookrunners);
  if (file.name.toLowerCase().endsWith('.xml')) {
    const parties = proposals.find(p => p.g === 'parties')?.payload;
    if (Array.isArray(parties)) mapped.draft.issuerName = parties.find(p => p.Roles?.includes('ISSUER'))?.PartyName ?? '';
  }
  return { ...mapped, fields };
}

/** Empty fields only, including explicitly cleared/locked fields. */
export function mergeDocumentFields(current: Record<string, string>, extracted: Record<string, string>, locked: Set<string> = new Set()) {
  const next = { ...current };
  for (const [path, value] of Object.entries(extracted)) if (value && !current[path]?.trim() && !locked.has(path)) next[path] = value;
  return next;
}