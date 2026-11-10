/**
 * Tranche term sheet field selection (Origin vs BDT 2.0 crosswalk,
 * reference/origin-templates/origin-bdt-crosswalk.md).
 *
 * Scopes:
 *  - deal   : one value for the whole deal, stored in the main term sheet (All fields).
 *  - copied : starts with Tranche A's value, editable per tranche.
 *  - own    : unique to each tranche.
 * Tranche A reads/writes the main term sheet directly, so All fields stays in sync.
 * Labels always come from the BDT dictionary (FIELDS) — no second field list.
 */
import { FIELDS } from './termsheet/index.js';
import type { RateType } from './dealWorkspace';

export type Scope = 'deal' | 'copied' | 'own';
export type Seniority = 'senior_unsecured' | 'senior_preferred' | 'senior_non_preferred' | 'tier2' | 'at1' | 'covered';

export const SENIORITY_LABEL: Record<Seniority, string> = {
  senior_unsecured: 'Senior unsecured',
  senior_preferred: 'Senior preferred',
  senior_non_preferred: 'Senior non-preferred',
  tier2: 'Subordinated (Tier 2)',
  at1: 'AT1',
  covered: 'Covered',
};

const I = 'IssuanceDataGroup/Issuance/';
const PR = 'IssuanceDataGroup/Product/';
const FX = PR + 'InterestPayment/FixedRatePayment/';
const FL = PR + 'InterestPayment/FloatingRatePayment/';
const ST = PR + 'StatusOfNote/';

export const SENIORITY_PRESET: Record<Seniority, Record<string, string>> = {
  senior_unsecured: { [ST + 'Seniority']: 'SENIOR', [ST + 'Subordinated']: 'UNSUBORDINATED', [ST + 'Secured']: 'UNSECURED' },
  senior_preferred: { [ST + 'Seniority']: 'SENIOR', [ST + 'Subordinated']: 'UNSUBORDINATED', [ST + 'Secured']: 'UNSECURED', [ST + 'Preferred']: 'PREFERRED' },
  senior_non_preferred: { [ST + 'Seniority']: 'SENIOR', [ST + 'Subordinated']: 'UNSUBORDINATED', [ST + 'Secured']: 'UNSECURED', [ST + 'Preferred']: 'NON_PREFERRED' },
  tier2: { [ST + 'Seniority']: 'JUNIOR', [ST + 'Subordinated']: 'SUBORDINATED', [ST + 'Secured']: 'UNSECURED' },
  at1: { [ST + 'Seniority']: 'JUNIOR', [ST + 'Subordinated']: 'SUBORDINATED', [ST + 'Secured']: 'UNSECURED' },
  covered: { [ST + 'Seniority']: 'SENIOR', [ST + 'Subordinated']: 'UNSUBORDINATED', [ST + 'Secured']: 'SECURED' },
};

interface Row { p: string; scope: Scope; rate?: RateType; sen?: Seniority[] }

const ROWS: Row[] = [
  // Deal-wide
  { p: 'DocumentInformation/DocumentDate', scope: 'deal' },
  { p: I + 'Programme/ProgrammeDescription', scope: 'deal' },
  { p: I + 'GoverningLaw/CountryCode', scope: 'deal' },
  { p: I + 'Listing/Listed', scope: 'deal' },
  { p: I + 'Listing/ListingVenue/Market', scope: 'deal' },
  { p: I + 'SecuritiesClearingSystem/Code', scope: 'deal' },
  { p: I + 'SellingRestrictions/CountryRestrictions', scope: 'deal' },
  { p: I + 'TargetMarket/ManufacturerTargetMarketType', scope: 'deal' },
  // Copied from Tranche A
  { p: I + 'SpecifiedCurrency', scope: 'copied' },
  { p: I + 'IssuanceType', scope: 'copied' },
  { p: I + 'SpecifiedDenomination/Value', scope: 'copied' },
  { p: I + 'PricingDate', scope: 'copied' },
  { p: I + 'SettlementDate', scope: 'copied' },
  { p: PR + 'InitialFormOfNote/PhysicalFormOfNote', scope: 'copied' },
  { p: I + 'SellingRestrictions/REGS/RegSCode', scope: 'copied' },
  { p: PR + 'CentralBankEligibility/Eligible', scope: 'copied' },
  { p: PR + 'BusinessDayConvention/BusinessDayAdjustment', scope: 'copied' },
  { p: PR + 'BusinessDayCenter/CityCalendar', scope: 'copied' },
  { p: I + 'Proceeds/UseOfProceeds/UseOfProceedsPrimaryCategory', scope: 'copied' },
  { p: I + 'Proceeds/UseOfProceeds/UseOfProceedsDescription', scope: 'copied' },
  { p: I + 'SellingRestrictions/TEFRA/TefraCode', scope: 'copied' },
  // Own
  { p: 'IssuanceDataGroup/SeriesTrancheClass/Series/SeriesIdentifier', scope: 'own' },
  { p: ST + 'Seniority', scope: 'own' },
  { p: ST + 'Subordinated', scope: 'own' },
  { p: ST + 'Secured', scope: 'own' },
  { p: ST + 'Preferred', scope: 'own', sen: ['senior_preferred', 'senior_non_preferred'] },
  { p: ST + 'AdditionalStatusOfNote', scope: 'own', sen: ['senior_non_preferred', 'tier2', 'at1'] },
  { p: PR + 'AggregateNominalAmount/Value', scope: 'own' },
  { p: PR + 'Maturity/MaturityDate', scope: 'own' },
  { p: FX + 'InterestRate', scope: 'own', rate: 'fixed' },
  { p: FX + 'InterestPayments/InterestPaymentFrequency', scope: 'own', rate: 'fixed' },
  { p: FX + 'InterestPayments/PayableDate/Day', scope: 'own', rate: 'fixed' },
  { p: FX + 'InterestPayments/PayableDate/Month', scope: 'own', rate: 'fixed' },
  { p: FX + 'InterestPayments/FirstPayment/PaymentDate', scope: 'own', rate: 'fixed' },
  { p: FL + 'Benchmark/BenchmarkCode', scope: 'own', rate: 'floating' },
  { p: FL + 'Benchmark/Term/TermUnit', scope: 'own', rate: 'floating' },
  { p: FL + 'Benchmark/Term/TermPeriod', scope: 'own', rate: 'floating' },
  { p: FL + 'Benchmark/Source', scope: 'own', rate: 'floating' },
  { p: FL + 'Spread/Value', scope: 'own', rate: 'floating' },
  { p: FL + 'Spread/PriceType', scope: 'own', rate: 'floating' },
  { p: FL + 'InterestPayments/InterestPaymentFrequency', scope: 'own', rate: 'floating' },
  { p: FL + 'InterestPayments/FirstPayment/PaymentDate', scope: 'own', rate: 'floating' },
  { p: FL + 'ResetDate', scope: 'own', rate: 'floating' },
  { p: FL + 'DeterminationMethod', scope: 'own', rate: 'floating' },
  { p: PR + 'InterestPayment/MinimumRate', scope: 'own', rate: 'floating' },
  { p: PR + 'InterestPayment/MaximumRate', scope: 'own', rate: 'floating' },
  { p: I + 'IssuePrice/Value', scope: 'own' },
  { p: I + 'Proceeds/Net/Value', scope: 'own' },
  { p: I + 'Redemption/FinalRedemptionPercentage', scope: 'own' },
  { p: PR + 'DayCountFraction', scope: 'own' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const byPath = new Map<string, any>((FIELDS as any[]).map(f => [f.p, f]));

export function trancheFields(rate: RateType, seniority: Seniority = 'senior_unsecured') {
  return ROWS
    .filter(r => (!r.rate || r.rate === rate) && (!r.sen || r.sen.includes(seniority)))
    .map(r => ({ ...r, fd: byPath.get(r.p) }))
    .filter(r => r.fd);
}

export const scopeOf = (p: string): Scope | undefined => ROWS.find(r => r.p === p)?.scope;

/**
 * Value shown for a field in a tranche panel.
 *  main = the deal's main term sheet values (All fields), own = tranche.values.
 */
export function trancheValue(p: string, isFirst: boolean, main: Record<string, string>, own: Record<string, unknown>): string {
  const scope = scopeOf(p);
  if (isFirst || scope === 'deal') return main[p] ?? '';
  if (p in own) return String(own[p] ?? '');
  return scope === 'copied' ? main[p] ?? '' : '';
}
