/**
 * Al Rajhi Bank Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk — the standard demo deal.
 * Single source for the demo: deal seed, illustrative pre-marketing chat, the four
 * real syndicate blasts (reference/al-rajhi-tier2/ 1.1 → 4.0) and the term sheet
 * stage each one represents. Real message files are kept verbatim in the reference folder.
 */
import type { Bookrunner, Deal, DealStage } from '@/types/bond';
import { stripHtml } from '@/lib/htmlText';
import ocAsset from '@/assets/al-rajhi/1.2_Al_Rajhi_Bank_-_Offering_Circular.pdf.asset.json';
import suppAsset from '@/assets/al-rajhi/1.3_Al_Rajhi_Bank_-_Supplement.pdf.asset.json';
// Full verbatim message texts (including the bank's legal footer).
import raw11 from '../../reference/al-rajhi-tier2/1.1_AL_RAJHI_BANK_-_TIER_2_US$_REG_S_10.5NC5.5_SOCIAL_SUKUK_-_IPTs_T_200bp.txt?raw';
import raw20 from '../../reference/al-rajhi-tier2/2.0_AL_RAJHI_BANK_-_Tier_II_-_Books_Over_$_1.6bn_ex_JLM_Interest.txt?raw';
import raw30 from '../../reference/al-rajhi-tier2/3.0_AL_RAJHI_BANK_-_Tier_II_-_Launched.txt?raw';
import raw40 from '../../reference/al-rajhi-tier2/4.0_AL_RAJHI_BANK_-_Tier_II_-_PRICED.txt?raw';
import html11 from '../../reference/al-rajhi-tier2/1.1_AL_RAJHI_BANK_-_TIER_2_US$_REG_S_10.5NC5.5_SOCIAL_SUKUK_-_IPTs_T_200bp.html?raw';
import html20 from '../../reference/al-rajhi-tier2/2.0_AL_RAJHI_BANK_-_Tier_II_-_Books_Over_$_1.6bn_ex_JLM_Interest.html?raw';
import html30 from '../../reference/al-rajhi-tier2/3.0_AL_RAJHI_BANK_-_Tier_II_-_Launched.html?raw';
import html40 from '../../reference/al-rajhi-tier2/4.0_AL_RAJHI_BANK_-_Tier_II_-_PRICED.html?raw';

export const DEMO_DEAL_NAME = 'Al Rajhi Bank – Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk';
export const isDemoDeal = (d: Pick<Deal, 'issuerName'>) => d.issuerName === DEMO_DEAL_NAME;

export const DEMO_ATTACHMENTS = [
  { name: 'Al Rajhi Bank - Offering Circular.pdf', url: ocAsset.url, size: ocAsset.size },
  { name: 'Al Rajhi Bank - Supplement.pdf', url: suppAsset.url, size: suppAsset.size },
];

const BOOKRUNNERS: Bookrunner[] = [
  'Al Rajhi Capital', 'Arqaam Capital', 'BBVA', 'Citi', 'IMI-Intesa Sanpaolo',
  'Morgan Stanley', 'Standard Chartered Bank', 'SMBC', 'Warba',
].map(name => ({ name, role: 'active' as const, isGlobalCoordinator: false }));

/** Fields known from the announcement / IPT blast (1.1). */
export const DEMO_BASE: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'> = {
  issuerName: DEMO_DEAL_NAME,
  issuerLEI: '549300FHETHK3XGY8N60',
  issuerRating: 'Baa2 / BBB+ (expected issue)',
  bookrunners: BOOKRUNNERS,
  currency: 'USD',
  size: 'Benchmark',
  tenor: '10.5NC5.5',
  coupon: '',
  stage: 'Announced',
  pricingDate: '2026-09-03',
  issueDate: '2026-09-10',
  settlementDate: '2026-09-10',
  maturityDate: '2037-03-10',
  specifiedDenomination: '200000',
  benchmark: 'Interpolated 5.5-year US Treasury',
  governingLaw: 'ENGLISH_LAW',
  listingVenue: 'London Stock Exchange ISM',
  interestType: 'FIXED',
  interestPaymentFrequency: 'SEMI_ANNUAL',
  dayCountFraction: '30_360',
};

export interface DemoStep {
  id: string;
  label: string;
  /** Deal lifecycle stage after this message. */
  stage: DealStage;
  /** Digital Term Sheet step (1 Announcement … 5 Priced). */
  bdtStage: number;
  sentAt: string;
  /** Board headline. */
  subject: string;
  body: string;
  /** Original Word structure for the board; plain body stays the parser input. */
  bodyHtml: string;
  attachments?: boolean;
  patch: Partial<Deal>;
  /** Term sheet values read from the message that have no flat deal column (BDT path → value). */
  bdtExtra?: Record<string, string>;
}

/** Illustrative only — written for the demo, not from the real files. */
export const PRE_MARKETING: string[] = [
  '[Illustrative · Mandate] Al Rajhi Bank has mandated Al Rajhi Capital, Arqaam Capital, BBVA, Citi, IMI-Intesa Sanpaolo, Morgan Stanley, Standard Chartered Bank, SMBC and Warba as JLMs/JBRs for a US$ Reg S Tier 2 Social Sukuk. SCB is Sole Sustainability Structurer.',
  '[Illustrative · Investor calls] Global investor calls held Mon/Tue. Strong feedback on the Social framework; investors focused on Tier 2 call structure (10.5NC5.5) and NVLA terms.',
  '[Illustrative · Announcement] Transaction expected to be launched today, subject to market conditions. Offering Circular and Supplement to follow with IPTs.',
];

export const DEMO_STEPS: DemoStep[] = [
  {
    id: '1.1', label: 'IPTs T+200bps area', stage: 'Announced', bdtStage: 2, attachments: true,
    sentAt: '2026-09-03T08:49:00Z',
    subject: '*** AL RAJHI BANK – TIER 2 US$ REG S 10.5NC5.5 SOCIAL SUKUK – IPTs T+200bps area ***',
    body: raw11,
    bodyHtml: html11,
    patch: { ipt: 'T+200bps area', stage: 'Announced' },
  },
  {
    id: '2.0', label: 'Books over $1.6bn', stage: 'Books Open', bdtStage: 3,
    sentAt: '2026-09-03T10:30:00Z',
    subject: '*** AL RAJHI BANK – Tier II – Books Over $ 1.6bn (ex JLM Interest) ***',
    body: raw20,
    bodyHtml: html20,
    patch: { guidance: 'Books over USD 1.6bn (ex JLM interest)', stage: 'Books Open' },
  },
  {
    id: '3.0', label: 'Launched $600mn at T+170', stage: 'Launched', bdtStage: 4,
    sentAt: '2026-09-03T12:15:00Z',
    subject: '*** AL RAJHI BANK – Tier II – Launched ***',
    body: raw30,
    bodyHtml: html30,
    patch: { size: '600m', reofferSpread: 'T+170', stage: 'Launched' },
  },
  {
    id: '4.0', label: 'Priced 6.232%', stage: 'Priced', bdtStage: 5,
    sentAt: '2026-09-03T15:40:00Z',
    subject: '*** AL RAJHI BANK – Tier II – PRICED ***',
    body: raw40,
    bodyHtml: html40,
    patch: {
      size: '600m', reofferSpread: 'T+170', reofferPrice: '100', issuePrice: '100',
      reofferYield: '6.232', coupon: '6.232', interestRate: '6.232',
      isin: 'XS3489932593', commonCode: '348993259', stage: 'Priced',
    },
    bdtExtra: {
      'IssuanceDataGroup/Product/StatusOfNote/Subordinated': 'SUBORDINATED',
      'IssuanceDataGroup/Product/Optionality': 'CALL',
      'IssuanceDataGroup/Product/ESGLabel': 'SOCIAL',
      'IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode': 'REGS_CAT2',
      'IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction': 'NO_EEA',
      'IssuanceDataGroup/Issuance/ReofferSpreadToBenchmark/Value': '170',
    },
  },
];

/** Present legacy generated board bodies with original Word structure, without
 * rewriting dated records or replacing subsequent user edits. */
export function demoBoardBody(id: string, body: string): string {
  if (!id.startsWith('demo-') || /<table\b/i.test(body)) return body;
  const step = DEMO_STEPS.find(s => id.endsWith(`-${s.id.replace('.', '-')}`));
  if (!step) return body;
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  return normalize(stripHtml(body)) === normalize(step.body) ? step.bodyHtml : body;
}

/** Cumulative deal fields at each Digital Term Sheet step (Announcement + the four blasts). */
export function demoStageSnapshots(): { bdtStage: number; label: string; sentAt?: string; deal: Partial<Deal>; bdtExtra?: Record<string, string> }[] {
  const out: { bdtStage: number; label: string; sentAt?: string; deal: Partial<Deal>; bdtExtra?: Record<string, string> }[] = [{ bdtStage: 1, label: 'Announcement', sentAt: '2026-09-03T08:00:00Z', deal: { ...DEMO_BASE, stage: 'Announced' as DealStage } as Partial<Deal> }];
  let acc: Partial<Deal> = { ...DEMO_BASE };
  let extra: Record<string, string> = {};
  for (const s of DEMO_STEPS) {
    acc = { ...acc, ...s.patch };
    extra = { ...extra, ...(s.bdtExtra ?? {}) };
    out.push({ bdtStage: s.bdtStage, label: s.label, sentAt: s.sentAt, deal: { ...acc }, bdtExtra: { ...extra } });
  }
  return out;
}
