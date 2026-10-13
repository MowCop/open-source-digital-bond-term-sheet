import { floatingRateChecks, esgChecks } from './conventionChecks';
/**
 * bdt-bridge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The ONLY seam between the vendored ICMA BDT 2.0 term sheet core
 * (src/lib/termsheet/, never modified) and the VDR application.
 *
 * Responsibilities
 *  1. `dealToBdtState`  — seed / hydrate the authoritative BDT state for a deal.
 *  2. `bdtToDealCache`  — project the authoritative state onto the flat `deals`
 *                         columns. Those columns are a DERIVED CACHE: written
 *                         only on save, never edited directly.
 *  3. `unifiedChecks`   — ONE validation surface. `checks(state)` from the core
 *                         runs first; the VDR holiday-calendar, settlement and
 *                         currency-benchmark rules are APPENDED to that same
 *                         list. There is no parallel validator.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  emptyState, refreshAuto, checks, FIELDS, STAGES,
} from '@/lib/termsheet/index.js';
import { validateDeal, type ValidationResult } from '@/lib/bondValidator';
import type { Bookrunner, Deal, DealStage, InterestType } from '@/types/bond';

// ─── State types (structural view of the vendored core's state) ───────────────

export interface BdtParty {
  PartyName: string;
  LEIIdentifier: string;
  BICIdentifier?: string;
  CountryOfIncorporation?: string;
  PartyType?: string;
  Roles: string[];
  Ratings: BdtRating[];
}
export interface BdtRating { RatingAgency: string; RatingValue: string; RatingOutlook: string }
export interface BdtId { Type: string; Value: string }
export interface BdtDoc { DocumentName: string; DocumentDate: string; DocumentLink: string; DocumentVersion: string }
export interface BdtContact { Name: string; Email: string }

export interface BdtState {
  stage: number;
  deal: string;
  ver: string;
  seq: number;
  f: Record<string, string>;
  contacts: BdtContact[];
  parties: BdtParty[];
  ids: BdtId[];
  ratings: BdtRating[];
  docs: BdtDoc[];
  releases: unknown[];
  suggestions: unknown[];
  files: unknown[];
}

export type CheckLevel = 'pass' | 'warn' | 'fail';
export interface CheckItem { l: CheckLevel; t: string; d?: string; src?: 'bdt' | 'vdr' | 'gleif' | 'openfigi' }

// ─── Canonical field paths (single source: FIELDS entries are selected by path) ──

export const P = {
  currency: 'IssuanceDataGroup/Issuance/SpecifiedCurrency',
  totalAmount: 'IssuanceDataGroup/Issuance/TotalAggregateAmount/Value',
  totalAmountType: 'IssuanceDataGroup/Issuance/TotalAggregateAmount/AmountType',
  nominalAmount: 'IssuanceDataGroup/Product/AggregateNominalAmount/Value',
  nominalCurrency: 'IssuanceDataGroup/Product/AggregateNominalAmount/Currency',
  maxAmount: 'IssuanceDataGroup/Issuance/MaximumAmount/Value',
  denomination: 'IssuanceDataGroup/Issuance/SpecifiedDenomination/Value',
  maturityDate: 'IssuanceDataGroup/Product/Maturity/MaturityDate',
  maturityType: 'IssuanceDataGroup/Product/Maturity/MaturityType',
  interestType: 'IssuanceDataGroup/Product/InterestPayment/InterestType',
  coupon: 'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate',
  couponFreq: 'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/InterestPaymentFrequency',
  dayCount: 'IssuanceDataGroup/Product/DayCountFraction',
  bizDay: 'IssuanceDataGroup/Product/BusinessDayConvention/BusinessDayAdjustment',
  pricingDate: 'IssuanceDataGroup/Issuance/PricingDate',
  issueDate: 'IssuanceDataGroup/Issuance/IssueDate',
  settlementDate: 'IssuanceDataGroup/Issuance/SettlementDate',
  issuePrice: 'IssuanceDataGroup/Issuance/IssuePrice/Value',
  reofferPrice: 'IssuanceDataGroup/Issuance/ReofferPrice/Value',
  reofferYield: 'IssuanceDataGroup/Issuance/ReofferYield/Value',
  spreadToMS: 'IssuanceDataGroup/Issuance/ReofferSpreadtoMidSwapRate/Value',
  spreadToBenchmark: 'IssuanceDataGroup/Issuance/ReofferSpreadToBenchmark/Value',
  midSwapRate: 'IssuanceDataGroup/Issuance/MidSwapRate/Rate/Value',
  benchmarkTicker: 'IssuanceDataGroup/Issuance/Benchmark/Ticker/Ticker',
  listed: 'IssuanceDataGroup/Issuance/Listing/Listed',
  listingVenue: 'IssuanceDataGroup/Issuance/Listing/ListingVenue/Market',
  governingLaw: 'IssuanceDataGroup/Issuance/GoverningLaw/CountryCode',
  dealIdentifier: 'IssuanceDataGroup/Issuance/DealIdentifier',
  issuanceType: 'IssuanceDataGroup/Issuance/IssuanceType',
  distribution: 'IssuanceDataGroup/Issuance/MethodOfDistribution/DistributionMethod',
  seniority: 'IssuanceDataGroup/Product/StatusOfNote/Seniority',
  subordinated: 'IssuanceDataGroup/Product/StatusOfNote/Subordinated',
  secured: 'IssuanceDataGroup/Product/StatusOfNote/Secured',
  legalTitleForm: 'IssuanceDataGroup/Product/InitialFormOfNote/LegalTitleFormOfNote',
  optionality: 'IssuanceDataGroup/Product/Optionality',
  sellingRestrictions: 'IssuanceDataGroup/Issuance/SellingRestrictions/AdditionalSellingRestrictions',
  ipt: 'x:iptSpread',
  guidance: 'x:guidance',
  spreadSet: 'x:spreadSet',
} as const;

/**
 * The Priority Execution Layer. These are PATHS ONLY — the rendered label,
 * type, options, hint and requirement all come from the matching FIELDS entry,
 * so every field has exactly one definition.
 */
export const PRIORITY_PATHS: string[] = [
  P.dealIdentifier,
  P.currency,
  P.totalAmount,
  P.maxAmount,
  P.maturityDate,
  P.coupon,
  P.couponFreq,
  P.pricingDate,
  P.issueDate,
  P.settlementDate,
  P.issuePrice,
  P.reofferYield,
  P.spreadToMS,
  P.benchmarkTicker,
  P.denomination,
  P.ipt,
  P.guidance,
  P.spreadSet,
];

export const fieldByPath = (p: string) => FIELDS.find((f: { p: string }) => f.p === p);

/** Priority fields resolved against the single FIELDS dictionary. */
export function priorityFields() {
  return PRIORITY_PATHS.map(fieldByPath).filter(Boolean) as Array<Record<string, unknown> & { p: string; l: string; t: string }>;
}

// ─── Stage mapping ────────────────────────────────────────────────────────────

const DEAL_STAGE_TO_BDT: Record<DealStage, number> = {
  'Mandate': 1,
  'Announced': 1,
  'Books Open': 3,
  'Launched': 4,
  'Books Closed': 4,
  'Priced': 5,
  'Settled': 7,
};

export const bdtStageForDeal = (s: DealStage): number => DEAL_STAGE_TO_BDT[s] ?? 1;
export const bdtStageLabel = (i: number): string => STAGES[Math.max(0, Math.min(STAGES.length - 1, i - 1))]?.t ?? '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const s = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => {
  const n = parseFloat(s(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/** "EUR 3bn" / "3,000,000,000" / "500m" → 3000000000 */
export function parseAmount(raw: string): number {
  const t = s(raw).trim().toLowerCase().replace(/,/g, '');
  const m = t.match(/([0-9]*\.?[0-9]+)\s*(bn|bln|billion|m|mm|mln|million|k)?/);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return NaN;
  switch (m[2]) {
    case 'bn': case 'bln': case 'billion': return n * 1e9;
    case 'm': case 'mm': case 'mln': case 'million': return n * 1e6;
    case 'k': return n * 1e3;
    default: return n;
  }
}

/** 3000000000 + EUR → "EUR 3bn" */
export function formatAmount(value: number, currency: string): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const cur = s(currency).toUpperCase();
  if (value >= 1e9) return `${cur} ${trimZeros(value / 1e9)}bn`;
  if (value >= 1e6) return `${cur} ${trimZeros(value / 1e6)}m`;
  return `${cur} ${value.toLocaleString('en-GB')}`.trim();
}
const trimZeros = (n: number) => String(Number(n.toFixed(3)));

const GOV_LAW_TO_ISO: Record<string, string> = {
  ENGLISH_LAW: 'GB', FRENCH_LAW: 'FR', GERMAN_LAW: 'DE', NEW_YORK_LAW: 'US', SWISS_LAW: 'CH',
};
const ISO_TO_GOV_LAW: Record<string, Deal['governingLaw']> = {
  GB: 'ENGLISH_LAW', FR: 'FRENCH_LAW', DE: 'GERMAN_LAW', US: 'NEW_YORK_LAW', CH: 'SWISS_LAW',
};

const FREQ_TO_APP: Record<string, string> = {
  ANNUALLY: 'ANNUAL', SEMIANNUALLY: 'SEMI_ANNUAL', QUARTERLY: 'QUARTERLY', MONTHLY: 'MONTHLY',
};
const FREQ_TO_BDT: Record<string, string> = {
  ANNUAL: 'ANNUALLY', ANNUALLY: 'ANNUALLY',
  SEMI_ANNUAL: 'SEMIANNUALLY', SEMIANNUAL: 'SEMIANNUALLY', 'SEMI-ANNUAL': 'SEMIANNUALLY',
  QUARTERLY: 'QUARTERLY', MONTHLY: 'MONTHLY', 'AT MATURITY': 'ATMATURITY',
};

/**
 * Legacy deal columns store dates as free text ("18 October 2036"). BDT date
 * fields are ISO-8601, so normalise on the way in; unparseable text is dropped
 * rather than guessed at.
 */
export function toISODate(v: unknown): string {
  const t = s(v).trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const MANAGER_ROLE_RE = /MANAGER|BOOKRUNNER|COORDINATOR|ARRANGER/;

// ─── 1. Seed / hydrate the authoritative state ────────────────────────────────

/**
 * Returns the deal's authoritative BDT state. When the deal already carries a
 * stored `bdtState`, that is returned (stage refreshed). Otherwise a fresh
 * state is seeded from the legacy flat columns so nothing is lost.
 */
export function dealToBdtState(deal: Deal): BdtState {
  const stored = (deal as unknown as { bdtState?: BdtState }).bdtState;
  if (stored && typeof stored === 'object' && stored.f) {
    const st: BdtState = { ...emptyState(), ...stored, f: { ...stored.f } };
    for (const k of Object.keys(st.f)) if (String(st.f[k]).trim() === 'NaN') delete st.f[k];
    st.stage = stored.stage || bdtStageForDeal(deal.stage);
    st.deal = stored.deal || deal.issuerName || '';
    return st;
  }
  return seedFromDeal(deal);
}

function seedFromDeal(deal: Deal): BdtState {
  const st = emptyState() as BdtState;
  st.stage = bdtStageForDeal(deal.stage);
  st.deal = deal.issuerName || '';
  const set = (p: string, v: unknown) => { const t = s(v).trim(); if (t && t !== 'NaN') st.f[p] = t; };

  set(P.dealIdentifier, deal.id);
  set(P.currency, (deal.currency || '').toUpperCase());
  set(P.nominalCurrency, (deal.currency || '').toUpperCase());

  const amount = parseAmount(deal.size);
  if (Number.isFinite(amount) && amount > 0) {
    set(P.totalAmount, String(amount));
    set(P.nominalAmount, String(amount));
    set(P.totalAmountType, 'NOMINAL');
  }

  set(P.denomination, deal.specifiedDenomination ? String(parseAmount(deal.specifiedDenomination)) : '');
  set(P.maturityDate, toISODate(deal.maturityDate));
  set(P.maturityType, 'FIXED');
  set(P.interestType, deal.interestType || 'FIXED');
  const cpn = num(deal.coupon);
  if (Number.isFinite(cpn)) set(P.coupon, String(cpn));
  set(P.couponFreq, FREQ_TO_BDT[s(deal.interestPaymentFrequency).toUpperCase().replace(/_/g, ' ').trim().replace(/ /g, '_')]
    || FREQ_TO_BDT[s(deal.interestPaymentFrequency).toUpperCase()] || '');
  set(P.dayCount, s(deal.dayCountFraction).replace(/_/g, '/'));
  set(P.pricingDate, toISODate(deal.pricingDate));
  set(P.issueDate, toISODate(deal.issueDate));
  set(P.settlementDate, toISODate(deal.settlementDate));
  // Issue price defaults to the re-offer price when the update omits it.
  set(P.issuePrice, num(deal.issuePrice || deal.reofferPrice));
  set(P.reofferPrice, num(deal.reofferPrice));
  set(P.reofferYield, num(deal.reofferYield));
  set(P.spreadToMS, num(deal.reofferSpread));
  set(P.midSwapRate, num(deal.midSwapRate));
  set(P.benchmarkTicker, deal.benchmark);
  set(P.ipt, deal.ipt);
  set(P.guidance, deal.guidance);
  set(P.listingVenue, deal.listingVenue);
  if (deal.listingVenue) set(P.listed, 'true');
  set(P.governingLaw, GOV_LAW_TO_ISO[s(deal.governingLaw)] || '');
  set(P.sellingRestrictions, deal.sellingRestrictions);
  set(P.issuanceType, deal.issuanceType || 'STANDALONE');
  set(P.distribution, 'SYNDICATED');

  // Parties: issuer first, then the bookrunner syndicate.
  st.parties = [];
  if (deal.issuerName) {
    st.parties.push({
      PartyName: deal.issuerName,
      LEIIdentifier: deal.issuerLEI || '',
      Roles: ['ISSUER'],
      Ratings: deal.issuerRating
        ? [{ RatingAgency: '', RatingValue: deal.issuerRating, RatingOutlook: s(deal.ratingOutlook).toUpperCase() }]
        : [],
    });
  }
  for (const b of deal.bookrunners ?? []) {
    st.parties.push({
      PartyName: b.name,
      LEIIdentifier: '',
      Roles: [b.isGlobalCoordinator ? 'GLOBAL_COORDINATOR' : (b.role === 'active' ? 'JOINT_BOOKRUNNER' : 'CO_MANAGER')],
      Ratings: [],
    });
  }

  st.ids = [];
  if (deal.isin) st.ids.push({ Type: 'ISIN', Value: deal.isin });
  if (deal.commonCode) st.ids.push({ Type: 'COMMON_CODE', Value: deal.commonCode });
  if (deal.cusip) st.ids.push({ Type: 'CUSIP', Value: deal.cusip });

  refreshAuto(st);
  return st;
}

// ─── 2. Derived cache projection ──────────────────────────────────────────────

/**
 * Projects the authoritative BDT state onto the flat `deals` columns.
 * Pure. Called only on save — the flat columns are never edited directly.
 */
export function bdtToDealCache(state: BdtState): Partial<Deal> {
  const v = (p: string) => { const t = s(state.f?.[p]).trim(); return t === 'NaN' ? '' : t; };
  const issuer = (state.parties ?? []).find(p => (p.Roles ?? []).includes('ISSUER'));
  const managers = (state.parties ?? []).filter(p => (p.Roles ?? []).some(r => MANAGER_ROLE_RE.test(r)));
  const currency = v(P.currency) || v(P.nominalCurrency);
  const amount = parseAmount(v(P.totalAmount) || v(P.nominalAmount));

  const bookrunners: Bookrunner[] = managers.map(m => ({
    name: m.PartyName,
    role: (m.Roles ?? []).some(r => /CO_MANAGER|PLACEMENT/.test(r)) ? 'passive' : 'active',
    isGlobalCoordinator: (m.Roles ?? []).includes('GLOBAL_COORDINATOR'),
  }));

  const id = (t: string) => (state.ids ?? []).find(x => x.Type === t)?.Value ?? '';
  const rating = issuer?.Ratings?.[0];

  const patch: Partial<Deal> = {
    issuerName: issuer?.PartyName || undefined,
    issuerLEI: issuer?.LEIIdentifier || undefined,
    issuerRating: rating?.RatingValue || undefined,
    ratingOutlook: rating?.RatingOutlook || undefined,
    bookrunners,
    currency: currency || undefined,
    size: formatAmount(amount, currency) || undefined,
    specifiedDenomination: v(P.denomination) || undefined,
    pricingDate: v(P.pricingDate) || undefined,
    issueDate: v(P.issueDate) || undefined,
    settlementDate: v(P.settlementDate) || undefined,
    issuePrice: v(P.issuePrice) || undefined,
    reofferPrice: v(P.reofferPrice) || undefined,
    reofferYield: v(P.reofferYield) || undefined,
    reofferSpread: v(P.spreadToMS) || v(P.spreadToBenchmark) || undefined,
    midSwapRate: v(P.midSwapRate) || undefined,
    benchmark: v(P.benchmarkTicker) || undefined,
    ipt: v(P.ipt) || undefined,
    guidance: v(P.guidance) || undefined,
    coupon: v(P.coupon) ? `${v(P.coupon)}%` : undefined,
    maturityDate: v(P.maturityDate) || undefined,
    tenor: tenorFrom(v(P.issueDate) || v(P.settlementDate), v(P.maturityDate)) || undefined,
    interestType: (v(P.interestType) || 'FIXED') as InterestType,
    interestPaymentFrequency: (FREQ_TO_APP[v(P.couponFreq)] as Deal['interestPaymentFrequency']) || undefined,
    dayCountFraction: (v(P.dayCount).replace(/\//g, '_') as Deal['dayCountFraction']) || undefined,
    isin: id('ISIN') || id('TEMPORARY_ISIN') || undefined,
    commonCode: id('COMMON_CODE') || undefined,
    cusip: id('CUSIP') || undefined,
    listingVenue: v(P.listingVenue) || undefined,
    governingLaw: ISO_TO_GOV_LAW[v(P.governingLaw).toUpperCase()] || undefined,
    sellingRestrictions: v(P.sellingRestrictions) || undefined,
  };

  // Drop undefined so a partial state never blanks an existing cached value.
  for (const k of Object.keys(patch) as Array<keyof Deal>) {
    if (patch[k] === undefined) delete patch[k];
  }
  return patch;
}

/** "2026-04-15" → "10Y" */
export function tenorFrom(startISO: string, maturityISO: string): string {
  if (!startISO || !maturityISO) return '';
  const a = new Date(startISO), b = new Date(maturityISO);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const years = (b.getTime() - a.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years <= 0) return '';
  const rounded = Math.round(years * 2) / 2;
  return Number.isInteger(rounded) ? `${rounded}Y` : `${rounded}Y`;
}

// ─── 3. One validation surface ────────────────────────────────────────────────

/** VDR rules appended to the core result list — none of these duplicate a BDT check. */
const VDR_RULE_IDS = new Set([
  'calendar-coverage',
  'settlement-non-business',
  'maturity-non-business',
  'issue-non-business',
  'pricing-non-business',
  'coupon-dates-non-business',
  'settlement-convention',
  'benchmark-currency-mismatch',
  'governing-law-currency',
  'tenor-maturity-mismatch',
  'isin-country-mismatch',
  'common-code-format',
  'denomination-below-minimum',
  'reoffer-price-extreme',
  'spread-yield-inconsistent',
  'yield-coupon-gap',
]);

const LEVEL_FROM_SEVERITY: Record<string, CheckLevel> = { error: 'fail', warning: 'warn', info: 'pass' };

/**
 * THE validation surface. `checks(state)` from the vendored core runs first;
 * the VDR holiday-calendar, settlement and currency-benchmark rules are
 * appended as further entries in the same list.
 */
export function unifiedChecks(state: BdtState, alertText?: string): CheckItem[] {
  const core: CheckItem[] = (checks(state) as CheckItem[]).map(c => ({ ...c, src: 'bdt' as const }));
  const cache = bdtToDealCache(state);
  const deal = { stage: 'Announced', bookrunners: [], ...cache } as unknown as Deal;

  let extra: ValidationResult[] = [];
  try {
    extra = validateDeal(deal, undefined, deal.stage, alertText)?.results ?? [];
  } catch {
    extra = [];
  }

  const appended: CheckItem[] = extra
    .filter(r => VDR_RULE_IDS.has(r.id))
    .map(r => ({
      l: LEVEL_FROM_SEVERITY[r.severity] ?? 'warn',
      t: r.title,
      d: r.detail,
      src: 'vdr' as const,
    }));

  const conventions: CheckItem[] = [...floatingRateChecks(state), ...esgChecks(state)].map(c => ({ ...c, src: 'vdr' as const }));
  return [...core, ...appended, ...conventions];
}

export function tallyChecks(items: CheckItem[]) {
  return items.reduce(
    (acc, c) => { acc[c.l] += 1; return acc; },
    { pass: 0, warn: 0, fail: 0 } as Record<CheckLevel, number>,
  );
}
