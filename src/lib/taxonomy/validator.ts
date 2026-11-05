/** Headless BDT 2.0 validator — runs in browser, Node or CLI. No imports. */
import type { BdtDocument, ValidationError, ValidationWarning, ValidationReport } from './types';

export const BDT_STAGE_NAMES = ['Mandate', 'IPTs', 'Guidance', 'Books Open', 'Books Closed', 'Priced', 'Settled'];

const P = {
  currency: 'IssuanceDataGroup/Issuance/SpecifiedCurrency',
  amount: 'IssuanceDataGroup/Issuance/TotalAggregateAmount/Value',
  maturity: 'IssuanceDataGroup/Product/Maturity/MaturityDate',
  interestType: 'IssuanceDataGroup/Product/InterestPayment/InterestType',
  coupon: 'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate',
  couponFreq: 'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/InterestPaymentFrequency',
  dayCount: 'IssuanceDataGroup/Product/DayCountFraction',
  pricingDate: 'IssuanceDataGroup/Issuance/PricingDate',
  settlementDate: 'IssuanceDataGroup/Issuance/SettlementDate',
  issueDate: 'IssuanceDataGroup/Issuance/IssueDate',
  reofferPrice: 'IssuanceDataGroup/Issuance/ReofferPrice/Value',
  reofferYield: 'IssuanceDataGroup/Issuance/ReofferYield/Value',
  benchmark: 'IssuanceDataGroup/Issuance/Benchmark/Ticker/Ticker',
  benchmarkCode: 'IssuanceDataGroup/Product/InterestPayment/FloatingRatePayment/ReferenceRate/BenchmarkCode',
  ipt: 'x:iptSpread', guidance: 'x:guidance', spreadSet: 'x:spreadSet',
} as const;

/** Paths required from each stage (cumulative). */
const STAGE_REQUIREMENTS: { stage: number; path: string; label: string }[] = [
  { stage: 1, path: P.currency, label: 'Currency' },
  { stage: 2, path: P.ipt, label: 'Initial price thoughts' },
  { stage: 2, path: P.maturity, label: 'Maturity date' },
  { stage: 3, path: P.guidance, label: 'Guidance' },
  { stage: 4, path: P.spreadSet, label: 'Spread set' },
  { stage: 5, path: P.amount, label: 'Total aggregate amount' },
  { stage: 6, path: P.pricingDate, label: 'Pricing date' },
  { stage: 6, path: P.settlementDate, label: 'Settlement date' },
  { stage: 6, path: P.reofferPrice, label: 'Re-offer price' },
  { stage: 6, path: P.dayCount, label: 'Day count fraction' },
  { stage: 7, path: P.issueDate, label: 'Issue date' },
];

export function validLEI(s: string): boolean {
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(s)) return false;
  const n = s.split('').map((c) => (/[0-9]/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('');
  let r = 0; for (const ch of n) r = (r * 10 + Number(ch)) % 97;
  return r === 1;
}

export function validISIN(s: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s)) return false;
  const d = s.slice(0, 11).split('').map((c) => (/[0-9]/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('');
  let sum = 0, dbl = true;
  for (let i = d.length - 1; i >= 0; i--) { let x = Number(d[i]); if (dbl) { x *= 2; if (x > 9) x -= 9; } sum += x; dbl = !dbl; }
  return (10 - (sum % 10)) % 10 === Number(s[11]);
}

const DAY_COUNTS = ['ACT/ACT', 'ACT/ACT (ICMA)', 'ACT/ACT (ISDA)', 'ACT/360', 'ACT/365', 'ACT/365 (FIXED)', '30/360', '30E/360', '30E/360 (ISDA)', 'BUS/252'];
const FREQS = ['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY', 'YEAR', 'QUARTER', 'MONTH', '1', '2', '4', '12'];
const CCY_BENCHMARK: Record<string, string[]> = { EUR: ['EURIBOR', 'EURI', 'ESTR', '€STR'], USD: ['SOFR'], GBP: ['SONIA', 'SONA'] };

/** Business days between two ISO dates (weekends excluded, holidays not modelled). */
export function businessDaysBetween(a: string, b: string): number | null {
  const da = new Date(`${a}T00:00:00Z`), db = new Date(`${b}T00:00:00Z`);
  if (isNaN(+da) || isNaN(+db) || db < da) return null;
  let n = 0; const d = new Date(da);
  while (d < db) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

export function validateBdt(doc: BdtDocument): ValidationReport {
  const stage = Math.min(7, Math.max(1, Math.round(doc.stage || 1)));
  const f = doc.f ?? {};
  const v = (p: string) => String(f[p] ?? '').trim();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const r of STAGE_REQUIREMENTS) {
    if (r.stage <= stage && !v(r.path)) errors.push({ code: 'STAGE_REQUIRED', path: r.path, stage: r.stage, message: `${r.label} is required from ${BDT_STAGE_NAMES[r.stage - 1]}.` });
  }
  if (!(doc.parties ?? []).some((p) => String(p.PartyName ?? '').trim())) errors.push({ code: 'ISSUER_REQUIRED', message: 'Issuer name is required.' });

  for (const p of doc.parties ?? []) {
    const lei = String(p.LEIIdentifier ?? '').trim().toUpperCase();
    if (lei && !validLEI(lei)) errors.push({ code: 'LEI_INVALID', message: `LEI ${lei} fails the ISO 17442 MOD 97-10 check.` });
    if (!lei && stage >= 6) warnings.push({ code: 'LEI_MISSING', message: `No LEI for ${p.PartyName || 'party'}.` });
  }
  for (const id of doc.ids ?? []) {
    if (/ISIN/.test(id.Type) && id.Value && !validISIN(id.Value.trim().toUpperCase())) errors.push({ code: 'ISIN_INVALID', message: `ISIN ${id.Value} fails the ISO 6166 check digit.` });
  }

  const ccy = v(P.currency).toUpperCase();
  if (ccy && !/^[A-Z]{3}$/.test(ccy)) errors.push({ code: 'CURRENCY_FORMAT', path: P.currency, message: 'Currency must be a three-letter ISO 4217 code.' });

  const dc = v(P.dayCount).toUpperCase();
  if (dc && !DAY_COUNTS.some((d) => d.replace(/\s/g, '') === dc.replace(/\s/g, ''))) warnings.push({ code: 'DAYCOUNT_UNKNOWN', path: P.dayCount, message: `Day count "${v(P.dayCount)}" is not a standard convention.` });
  const freq = v(P.couponFreq).toUpperCase();
  if (freq && !FREQS.includes(freq)) warnings.push({ code: 'FREQUENCY_UNKNOWN', path: P.couponFreq, message: `Coupon frequency "${v(P.couponFreq)}" is not standard.` });
  if (dc && ccy === 'USD' && !/30\/360/.test(dc) && /FIXED/i.test(v(P.interestType))) warnings.push({ code: 'DAYCOUNT_CONVENTION', path: P.dayCount, message: 'USD fixed-rate notes usually use 30/360.' });
  if (dc && ccy === 'EUR' && /FIXED/i.test(v(P.interestType)) && !/ACT\/ACT/.test(dc)) warnings.push({ code: 'DAYCOUNT_CONVENTION', path: P.dayCount, message: 'EUR fixed-rate notes usually use ACT/ACT (ICMA).' });

  const pd = v(P.pricingDate), sd = v(P.settlementDate);
  if (pd && sd) {
    const t = businessDaysBetween(pd, sd);
    if (t === null) errors.push({ code: 'SETTLEMENT_BEFORE_PRICING', path: P.settlementDate, message: 'Settlement date must be on or after pricing date.' });
    else if (t < 2 || t > 10) warnings.push({ code: 'SETTLEMENT_CYCLE', path: P.settlementDate, message: `Settlement is T+${t}; standard cycles are T+2 to T+5.` });
  }
  const mat = v(P.maturity);
  if (mat && sd && mat <= sd) errors.push({ code: 'MATURITY_BEFORE_SETTLEMENT', path: P.maturity, message: 'Maturity must be after settlement.' });

  const bench = `${v(P.benchmark)} ${v(P.benchmarkCode)}`.toUpperCase();
  if (ccy && bench.trim()) {
    for (const [c, names] of Object.entries(CCY_BENCHMARK)) {
      if (c !== ccy && names.some((n) => bench.includes(n)) && !(CCY_BENCHMARK[ccy] ?? []).some((n) => bench.includes(n))) {
        warnings.push({ code: 'BENCHMARK_CURRENCY', message: `Benchmark ${bench.trim()} is a ${c} rate but the currency is ${ccy}.` });
      }
    }
  }
  const coupon = v(P.coupon);
  if (coupon && (isNaN(Number(coupon)) || Number(coupon) < 0 || Number(coupon) > 25)) warnings.push({ code: 'COUPON_RANGE', path: P.coupon, message: `Coupon ${coupon} looks out of range.` });

  const stageName = BDT_STAGE_NAMES[stage - 1];
  return {
    isValid: errors.length === 0, stage, stageName, errors, warnings,
    summary: errors.length === 0
      ? `Valid for ${stageName}${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.`
      : `${errors.length} error(s) and ${warnings.length} warning(s) at ${stageName}.`,
  };
}
