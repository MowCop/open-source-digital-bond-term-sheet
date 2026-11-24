/**
 * Meridian Gulf Bank Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk: the standard demo deal.
 * FICTIONAL: the issuer, banks, identifiers and numbers are invented for the demo.
 * Single source for the demo: deal seed, illustrative pre-marketing chat, the four
 * syndicate messages (reference/demo-deal/ 1.1 → 4.0) and the term sheet stage
 * each one represents.
 */
import type { Bookrunner, Deal, DealStage } from '@/types/bond';
import { stripHtml } from '@/lib/htmlText';
// Message texts as they would arrive (plain text is the parser input; HTML is the board view).
import raw11 from '../../reference/demo-deal/1.1_IPTs.txt?raw';
import raw20 from '../../reference/demo-deal/2.0_Books.txt?raw';
import raw30 from '../../reference/demo-deal/3.0_Launched.txt?raw';
import raw40 from '../../reference/demo-deal/4.0_Priced.txt?raw';
import html11 from '../../reference/demo-deal/1.1_IPTs.html?raw';
import html20 from '../../reference/demo-deal/2.0_Books.html?raw';
import html30 from '../../reference/demo-deal/3.0_Launched.html?raw';
import html40 from '../../reference/demo-deal/4.0_Priced.html?raw';

export const DEMO_DEAL_NAME = 'Meridian Gulf Bank – Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk';
export const isDemoDeal = (d: Pick<Deal, 'issuerName'>) => d.issuerName === DEMO_DEAL_NAME;

export const DEMO_ATTACHMENTS = [
  { name: 'Meridian Gulf - Offering Circular (fictional).pdf', url: '/deal-docs/meridian-gulf-offering-circular.pdf', size: 2478 },
  { name: 'Meridian Gulf - Supplement (fictional).pdf', url: '/deal-docs/meridian-gulf-supplement.pdf', size: 2401 },
];

const BOOKRUNNERS: Bookrunner[] = [
  'Atlas Markets', 'Cedarstone Capital', 'Harbourline Securities',
  'Lumen Investment Bank', 'Meridian Capital', 'Northgate Bank',
].map(name => ({ name, role: 'active' as const, isGlobalCoordinator: false }));

/** Fields known from the announcement / IPT blast (1.1). */
export const DEMO_BASE: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'> = {
  issuerName: DEMO_DEAL_NAME,
  issuerLEI: '9999MERIDIANGULF0S58',
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

/** Illustrative pre-marketing chat for the fictional demo deal. */
export const PRE_MARKETING: string[] = [
  '[Illustrative · Mandate] Meridian Gulf Bank has mandated Atlas Markets, Cedarstone Capital, Harbourline Securities, Lumen Investment Bank, Meridian Capital and Northgate Bank as JLMs/JBRs for a US$ Reg S Tier 2 Social Sukuk (fictional demo deal).',
  '[Illustrative · Investor calls] Global investor calls held Mon/Tue. Strong feedback on the Social framework; investors focused on Tier 2 call structure (10.5NC5.5) and NVLA terms.',
  '[Illustrative · Announcement] Transaction expected to be launched today, subject to market conditions. Offering Circular and Supplement to follow with IPTs.',
];

export const DEMO_STEPS: DemoStep[] = [
  {
    id: '1.1', label: 'IPTs T+205bps area', stage: 'Announced', bdtStage: 2, attachments: true,
    sentAt: '2026-09-03T08:49:00Z',
    subject: '*** MERIDIAN GULF BANK – TIER 2 US$ REG S 10.5NC5.5 SOCIAL SUKUK – IPTs T+205bps area ***',
    body: raw11,
    bodyHtml: html11,
    patch: { ipt: 'T+205bps area', stage: 'Announced' },
  },
  {
    id: '2.0', label: 'Books over $1.4bn', stage: 'Books Open', bdtStage: 3,
    sentAt: '2026-09-03T10:30:00Z',
    subject: '*** MERIDIAN GULF BANK – Tier II – Books over 1.4bn (USD, ex JLM interest) ***',
    body: raw20,
    bodyHtml: html20,
    patch: { guidance: 'Books over USD 1.4bn (ex JLM interest)', stage: 'Books Open' },
  },
  {
    id: '3.0', label: 'Launched $500mn at T+175', stage: 'Launched', bdtStage: 4,
    sentAt: '2026-09-03T12:15:00Z',
    subject: '*** MERIDIAN GULF BANK – Tier II – Launched ***',
    body: raw30,
    bodyHtml: html30,
    patch: { size: '500m', reofferSpread: 'T+175', stage: 'Launched' },
  },
  {
    id: '4.0', label: 'Priced 5.807%', stage: 'Priced', bdtStage: 5,
    sentAt: '2026-09-03T15:40:00Z',
    subject: '*** MERIDIAN GULF BANK – Tier II – PRICED ***',
    body: raw40,
    bodyHtml: html40,
    patch: {
      size: '500m', reofferSpread: 'T+175', reofferPrice: '100', issuePrice: '100',
      reofferYield: '5.807', coupon: '5.807', interestRate: '5.807',
      isin: 'XS9990000028', commonCode: '999000002', stage: 'Priced',
    },
    bdtExtra: {
      'IssuanceDataGroup/Product/StatusOfNote/Subordinated': 'SUBORDINATED',
      'IssuanceDataGroup/Product/Optionality': 'CALL',
      'IssuanceDataGroup/Product/ESGLabel': 'SOCIAL',
      'IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode': 'REGS_CAT2',
      'IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction': 'NO_EEA',
      'IssuanceDataGroup/Issuance/ReofferSpreadToBenchmark/Value': '175',
      'x:spreadSet': 'T+175',
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
