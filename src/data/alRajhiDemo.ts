/**
 * Al Rajhi Bank Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk — the standard demo deal.
 * Single source for the demo: deal seed, illustrative pre-marketing chat, the four
 * real syndicate blasts (reference/al-rajhi-tier2/ 1.1 → 4.0) and the term sheet
 * stage each one represents. Real message files are kept verbatim in the reference folder.
 */
import type { Bookrunner, Deal, DealStage } from '@/types/bond';
import ocAsset from '@/assets/al-rajhi/1.2_Al_Rajhi_Bank_-_Offering_Circular.pdf.asset.json';
import suppAsset from '@/assets/al-rajhi/1.3_Al_Rajhi_Bank_-_Supplement.pdf.asset.json';

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
  governingLaw: 'English' as Deal['governingLaw'],
  listingVenue: 'London Stock Exchange ISM',
  interestType: 'FIXED' as Deal['interestType'],
  interestPaymentFrequency: 'SEMI_ANNUAL' as Deal['interestPaymentFrequency'],
};

export interface DemoStep {
  id: string;
  label: string;
  /** Deal lifecycle stage after this message. */
  stage: DealStage;
  /** Digital Term Sheet step (1 Announcement … 5 Priced). */
  bdtStage: number;
  sentAt: string;
  body: string;
  attachments?: boolean;
  patch: Partial<Deal>;
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
    body: `*** AL RAJHI BANK – TIER 2 US$ REG S 10.5NC5.5 SOCIAL SUKUK – IPTs T+200bps area ***
Issuer: Al Rajhi Sukuk Limited
Obligor: Al Rajhi Banking and Investment Corporation
Issuer LEI: 549300FHETHK3XGY8N60
Expected Issue Rating: Baa2 by Moody's / BBB+ by Fitch
Status: Tier 2 Certificates · Type: Social Certificates
Format: Regulation S, Category 2, Registered Form
Currency: USD
Issue Size: Benchmark
Tenor: 10.5 years non-call 5.5 years
IPT: T+200bps area
Pricing Date: 03 September 2026
Issue Date: 10 September 2026
Maturity Date: 10 March 2037
Denominations: USD 200,000 x 1,000
Governing Law: English Law
Listing: London Stock Exchange ISM
Attachments: Offering Circular, Supplement`,
    patch: { ipt: 'T+200bps area', stage: 'Announced' },
  },
  {
    id: '2.0', label: 'Books over $1.6bn', stage: 'Books Open', bdtStage: 3,
    sentAt: '2026-09-03T10:30:00Z',
    body: '*** AL RAJHI BANK – Tier II – Books Over $ 1.6bn (ex JLM Interest) ***',
    patch: { guidance: 'Books over USD 1.6bn (ex JLM interest)', stage: 'Books Open' },
  },
  {
    id: '3.0', label: 'Launched $600mn at T+170', stage: 'Launched', bdtStage: 4,
    sentAt: '2026-09-03T12:15:00Z',
    body: `*** AL RAJHI BANK – Tier II – Launched ***
- Size set at $ 600mn
- Spread set at T + 170bps (the #)
- Books in excess of 1.35bn (ex JLM Interest)
- Global books have gone subject
- Allocations to follow`,
    patch: { size: '600m', reofferSpread: 'T+170', stage: 'Launched' },
  },
  {
    id: '4.0', label: 'Priced 6.232%', stage: 'Priced', bdtStage: 5,
    sentAt: '2026-09-03T15:40:00Z',
    body: `*** AL RAJHI BANK – Tier II – PRICED ***
Issuer: Al Rajhi Sukuk Limited
Issue Size: USD 600,000,000
Tenor: 10.5 years non-call 5.5 years
Pricing Date: 03-Sep-26
Issue Date: 10-Sep-26
Maturity Date: 10-Mar-37
Benchmark: Interpolated 5.5-year US Treasury (T 4 3/8 08/31/31 4.502% / T 4 1/2 08/31/33 4.617%)
Reoffer Spread: 170 basis points
Reoffer Price: 100
Reoffer Yield: 6.232%
Coupon: 6.232%
ISIN: XS3489932593
Common Code: 348993259
Denominations: USD 200,000 x 1,000
Governing Law: English Law
Listing: London Stock Exchange ISM`,
    patch: {
      size: '600m', reofferSpread: 'T+170', reofferPrice: '100', issuePrice: '100',
      reofferYield: '6.232', coupon: '6.232', interestRate: '6.232',
      isin: 'XS3489932593', commonCode: '348993259', stage: 'Priced',
    },
  },
];

/** Cumulative deal fields at each Digital Term Sheet step (Announcement + the four blasts). */
export function demoStageSnapshots(): { bdtStage: number; label: string; deal: Partial<Deal> }[] {
  const out = [{ bdtStage: 1, label: 'Announcement', deal: { ...DEMO_BASE, stage: 'Announced' as DealStage } as Partial<Deal> }];
  let acc: Partial<Deal> = { ...DEMO_BASE };
  for (const s of DEMO_STEPS) {
    acc = { ...acc, ...s.patch };
    out.push({ bdtStage: s.bdtStage, label: s.label, deal: { ...acc } });
  }
  return out;
}
