/**
 * bondValidator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop into: src/lib/bondValidator.ts
 *
 * Pure TypeScript — zero runtime dependencies beyond date-fns (already in
 * the project).  Call validateDeal() with a partial Deal object at any point
 * in the Create New Issue workflow; it returns a sorted list of ValidationResult
 * items that the UI renders as errors / warnings / info notices.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Deal, DayCountFraction, InterestType, InterestPaymentFrequency, BusinessDayConvention } from '@/types/bond';

// ─── Result types ─────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  id: string;           // stable key for React list rendering
  severity: Severity;
  field: string;        // which Deal field triggered this
  title: string;        // short label shown in the badge/row
  detail: string;       // one-sentence explanation for the tooltip / expanded row
  icmaRef?: string;     // optional ICMA / ISDA rule reference
}

// ─── Business-day calendar ────────────────────────────────────────────────────
// Hardcoded TARGET2 holidays 2024-2027 + London bank holidays + US federal holidays.
// Extend the relevant set when Euroclear publishes next year's calendar.

const TARGET2_HOLIDAYS = new Set([
  // 2024
  '2024-01-01','2024-03-29','2024-04-01','2024-05-01','2024-12-25','2024-12-26',
  // 2025
  '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-12-25','2025-12-26',
  // 2026
  '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-25','2026-12-28',
  // 2027
  '2027-01-01','2027-03-26','2027-03-29','2027-05-01','2027-12-25','2027-12-27',
]);

const LONDON_HOLIDAYS = new Set([
  // 2024
  '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
  // 2025
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  // 2026
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28',
  // 2027
  '2027-01-01','2027-03-26','2027-03-29','2027-05-03','2027-05-31','2027-08-30','2027-12-27','2027-12-28',
]);

const US_HOLIDAYS = new Set([
  // 2024
  '2024-01-01','2024-01-15','2024-02-19','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-10-14','2024-11-11','2024-11-28','2024-12-25',
  // 2025
  '2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25',
  // 2026
  '2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25',
  // 2027
  '2027-01-01','2027-01-18','2027-02-15','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-10-11','2027-11-11','2027-11-25','2027-12-24',
]);

type CalendarKey = 'TARGET2' | 'LONDON' | 'US';

function holidaySet(calendar: CalendarKey): Set<string> {
  if (calendar === 'TARGET2') return TARGET2_HOLIDAYS;
  if (calendar === 'LONDON')  return LONDON_HOLIDAYS;
  return US_HOLIDAYS;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isBusinessDay(dateStr: string, calendar: CalendarKey): boolean {
  const d = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(d.getTime())) return false;
  if (isWeekend(d)) return false;
  return !holidaySet(calendar).some(h => h === toISO(d));
}

function calendarForCurrency(currency: string): CalendarKey {
  if (currency === 'GBP') return 'LONDON';
  if (currency === 'USD') return 'US';
  return 'TARGET2'; // EUR, CHF, default
}

// Apply Modified Following: advance to next business day (unless it crosses month boundary → preceding)
function modifiedFollowing(dateStr: string, calendar: CalendarKey): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  if (isNaN(d.getTime())) return dateStr;
  const origMonth = d.getUTCMonth();
  let candidate = new Date(d);
  // Try following
  while (!isBusinessDay(toISO(candidate), calendar)) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  if (candidate.getUTCMonth() !== origMonth) {
    // Crossed month — go preceding instead
    candidate = new Date(d);
    while (!isBusinessDay(toISO(candidate), calendar)) {
      candidate.setUTCDate(candidate.getUTCDate() - 1);
    }
  }
  return toISO(candidate);
}

// ─── ISIN check-digit (ISO 6166) ──────────────────────────────────────────────

function validateISIN(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  // Convert letters to digits (A=10, B=11 … Z=35)
  const digits = isin
    .split('')
    .map(c => (c >= 'A' ? (c.charCodeAt(0) - 55).toString() : c))
    .join('');
  // Luhn mod-10
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ─── LEI format (GLEIF) ───────────────────────────────────────────────────────

function validateLEIFormat(lei: string): boolean {
  return /^[A-Z0-9]{18}[0-9]{2}$/.test(lei);
}

// ─── Size parser ──────────────────────────────────────────────────────────────

function parseSize(raw: string): number | null {
  const clean = raw.replace(/[, ]/g, '');
  const multipliers: Record<string, number> = { bn: 1e9, billion: 1e9, mm: 1e6, m: 1e6, million: 1e6 };
  const match = clean.match(/^([\d.]+)(bn|billion|mm|million|m)?$/i);
  if (!match) return null;
  const base = parseFloat(match[1]);
  const mult = match[2] ? multipliers[match[2].toLowerCase()] : 1;
  return base * (mult ?? 1);
}

// ─── Date utilities ───────────────────────────────────────────────────────────

function parseDate(s: string | undefined): Date | null {
  if (!s || s === 'TBA' || s === 'TBD') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ─── Tenor parser → approximate days ─────────────────────────────────────────

function tenorToDays(tenor: string): number | null {
  const m = tenor.trim().match(/^(\d+)\s*Y$/i);
  if (m) return parseInt(m[1], 10) * 365;
  const m2 = tenor.trim().match(/^(\d+)\s*M$/i);
  if (m2) return parseInt(m2[1], 10) * 30;
  return null;
}

// ─── Coupon date generator ────────────────────────────────────────────────────
// Generate the first N coupon payment dates from issueDate using the given frequency.

function generateCouponDates(
  issueDateStr: string,
  freq: InterestPaymentFrequency,
  n: number = 4,
): string[] {
  const issueDate = parseDate(issueDateStr);
  if (!issueDate) return [];
  const monthStep = freq === 'ANNUAL' ? 12 : freq === 'SEMI_ANNUAL' ? 6 : freq === 'QUARTERLY' ? 3 : 1;
  const dates: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(issueDate);
    d.setUTCMonth(d.getUTCMonth() + monthStep * i);
    dates.push(toISO(d));
  }
  return dates;
}

// ─── Day count ↔ interest type consistency ────────────────────────────────────

function dayCountConsistentWithType(
  dcf: DayCountFraction | undefined,
  iType: InterestType | undefined,
): boolean {
  if (!dcf || !iType) return true; // can't check yet
  if (iType === 'ZERO_COUPON') return true; // any dcf is fine for ZC
  // Eurobond / EUR fixed: conventionally ACT_ACT
  // US corporates: 30_360
  // Floating: ACT_360 or ACT_365
  if (iType === 'FLOATING' && dcf === 'ACT_ACT') return false;
  if (iType === 'FIXED' && dcf === 'ACT_360') return false;
  return true;
}

// ─── Settlement T+N convention ────────────────────────────────────────────────

function expectedSettlementDays(currency: string): number {
  return currency === 'USD' ? 2 : 2; // T+2 for EUR/GBP/CHF; USD moving to T+1 in 2025 but 2 still common
}

// ─── Reoffer yield ↔ coupon ↔ price sanity ───────────────────────────────────
// Very rough check: if coupon > reoffer yield by more than 3pp, flag it.

function checkYieldCouponConsistency(
  coupon: string | undefined,
  reofferYield: string | undefined,
): boolean {
  if (!coupon || !reofferYield) return true;
  const c = parseFloat(coupon.replace('%', '').replace(/[^\d.]/g, ''));
  const y = parseFloat(reofferYield.replace('%', '').replace(/[^\d.]/g, ''));
  if (isNaN(c) || isNaN(y)) return true;
  return Math.abs(c - y) < 3;
}

// ─── Mid-swap + spread → implied yield consistency ────────────────────────────

function checkSpreadYieldImplied(
  midSwap: string | undefined,
  spread: string | undefined,
  reofferYield: string | undefined,
): { ok: boolean; implied?: string } {
  if (!midSwap || !spread || !reofferYield) return { ok: true };
  const ms = parseFloat(midSwap.replace('%', '').replace(/[^\d.]/g, ''));
  const sp = parseFloat(spread.replace(/[^\d.+\-]/g, '')) / 100; // bps → %
  const ry = parseFloat(reofferYield.replace('%', '').replace(/[^\d.]/g, ''));
  if (isNaN(ms) || isNaN(sp) || isNaN(ry)) return { ok: true };
  const implied = (ms + sp);
  const diff = Math.abs(implied - ry);
  return { ok: diff < 0.05, implied: implied.toFixed(3) + '%' };
}

// ─── Denomination check ───────────────────────────────────────────────────────
// Euronext Dublin / Luxembourg: min 100,000 for Reg S. US 144A: min 200,000.

function checkDenomination(
  denom: string | undefined,
  listingVenue: string | undefined,
  sellingRestrictions: string | undefined,
): { ok: boolean; min?: number } {
  if (!denom) return { ok: true };
  const n = parseFloat(denom.replace(/[, ]/g, ''));
  if (isNaN(n)) return { ok: true };
  const is144A = sellingRestrictions?.toLowerCase().includes('144a');
  const min = is144A ? 200000 : 100000;
  return { ok: n >= min, min };
}

// ─── ISIN country prefix consistency ─────────────────────────────────────────

const CCY_TO_LIKELY_COUNTRY: Record<string, string[]> = {
  EUR: ['XS','DE','FR','IT','ES','NL','BE','AT','PT','FI','IE'],
  GBP: ['XS','GB'],
  USD: ['US','XS'],
  CHF: ['CH','XS'],
};

function checkISINCountryPrefix(isin: string | undefined, currency: string | undefined): boolean {
  if (!isin || !currency) return true;
  const prefix = isin.slice(0, 2);
  const allowed = CCY_TO_LIKELY_COUNTRY[currency];
  if (!allowed) return true;
  return allowed.includes(prefix);
}

// ─── Common Code format ───────────────────────────────────────────────────────

function validateCommonCode(cc: string | undefined): boolean {
  if (!cc) return true;
  return /^\d{6,9}$/.test(cc.trim());
}

// ─── CUSIP format ─────────────────────────────────────────────────────────────

function validateCUSIP(cusip: string | undefined): boolean {
  if (!cusip) return true;
  return /^[0-9A-Z]{9}$/.test(cusip.trim());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export function validateDeal(deal: Partial<Deal>): ValidationResult[] {
  const results: ValidationResult[] = [];
  const cal = calendarForCurrency(deal.currency ?? 'EUR');

  // ── 1. Settlement date: weekend / holiday ────────────────────────────────
  if (deal.settlementDate && deal.settlementDate !== 'TBA') {
    if (!isBusinessDay(deal.settlementDate, cal)) {
      const adjusted = modifiedFollowing(deal.settlementDate, cal);
      results.push({
        id: 'settlement-non-business',
        severity: 'error',
        field: 'settlementDate',
        title: 'Settlement on non-business day',
        detail: `Settlement date ${deal.settlementDate} falls on a weekend or ${cal} holiday. Modified Following convention suggests ${adjusted}.`,
        icmaRef: 'ICMA Rule 251.2 / Business Day Convention',
      });
    }
  }

  // ── 2. Maturity date: weekend / holiday ──────────────────────────────────
  if (deal.maturityDate && deal.maturityDate !== 'TBA') {
    if (!isBusinessDay(deal.maturityDate, cal)) {
      const adjusted = modifiedFollowing(deal.maturityDate, cal);
      results.push({
        id: 'maturity-non-business',
        severity: 'error',
        field: 'maturityDate',
        title: 'Maturity on non-business day',
        detail: `Maturity date ${deal.maturityDate} is not a ${cal} business day. Adjusted date would be ${adjusted}.`,
        icmaRef: 'ICMA Rule 251.2',
      });
    }
  }

  // ── 3. Pricing date: weekend / holiday ───────────────────────────────────
  if (deal.pricingDate && deal.pricingDate !== 'TBA') {
    if (!isBusinessDay(deal.pricingDate, cal)) {
      results.push({
        id: 'pricing-non-business',
        severity: 'warning',
        field: 'pricingDate',
        title: 'Pricing on non-business day',
        detail: `Pricing date ${deal.pricingDate} is a weekend or public holiday. Confirm this is intentional.`,
      });
    }
  }

  // ── 4. Coupon payment dates: weekend / holiday ───────────────────────────
  if (deal.issueDate && deal.issueDate !== 'TBA' && deal.interestPaymentFrequency && deal.interestType !== 'ZERO_COUPON') {
    const couponDates = generateCouponDates(deal.issueDate, deal.interestPaymentFrequency, 4);
    const badDates = couponDates.filter(d => !isBusinessDay(d, cal));
    if (badDates.length > 0) {
      const adjConv = deal.businessDayConvention ?? 'not specified';
      results.push({
        id: 'coupon-dates-non-business',
        severity: 'warning',
        field: 'interestPaymentFrequency',
        title: 'Coupon dates fall on non-business days',
        detail: `${badDates.length} of the first 4 coupon dates (${badDates.join(', ')}) are non-${cal} business days. Business day convention is ${adjConv}.`,
        icmaRef: 'ICMA Rule 251.1(iii)',
      });
    }
  }

  // ── 5. Maturity date after issue date ────────────────────────────────────
  const issueD = parseDate(deal.issueDate);
  const maturityD = parseDate(deal.maturityDate);
  if (issueD && maturityD) {
    if (maturityD <= issueD) {
      results.push({
        id: 'maturity-before-issue',
        severity: 'error',
        field: 'maturityDate',
        title: 'Maturity not after issue date',
        detail: `Maturity date (${deal.maturityDate}) must be strictly after issue date (${deal.issueDate}).`,
      });
    }
  }

  // ── 6. Tenor ↔ maturity consistency ─────────────────────────────────────
  if (issueD && maturityD && deal.tenor) {
    const expectedDays = tenorToDays(deal.tenor);
    const actualDays = diffDays(issueD, maturityD);
    if (expectedDays !== null && Math.abs(actualDays - expectedDays) > 14) {
      results.push({
        id: 'tenor-maturity-mismatch',
        severity: 'warning',
        field: 'tenor',
        title: 'Tenor/maturity mismatch',
        detail: `Stated tenor is ${deal.tenor} (~${expectedDays} days) but issue→maturity is ${actualDays} days. Difference of ${Math.abs(actualDays - expectedDays)} days — please verify.`,
      });
    }
  }

  // ── 7. Settlement = issue + T+N ──────────────────────────────────────────
  const settlementD = parseDate(deal.settlementDate);
  if (issueD && settlementD && deal.currency) {
    const expectedT = expectedSettlementDays(deal.currency);
    const actualT = diffDays(issueD, settlementD);
    if (actualT !== expectedT && actualT !== 0) {
      results.push({
        id: 'settlement-convention',
        severity: 'warning',
        field: 'settlementDate',
        title: `Settlement not T+${expectedT}`,
        detail: `For ${deal.currency} bonds, standard settlement is T+${expectedT}. Issue date ${deal.issueDate} implies settlement ${toISO(new Date(issueD.getTime() + expectedT * 86400000))}, but ${deal.settlementDate} is T+${actualT}.`,
        icmaRef: 'ICMA / CSDR Settlement Discipline',
      });
    }
  }

  // ── 8. ISIN check-digit ──────────────────────────────────────────────────
  if (deal.isin && deal.isin !== 'TBA') {
    if (!validateISIN(deal.isin)) {
      results.push({
        id: 'isin-invalid',
        severity: 'error',
        field: 'isin',
        title: 'Invalid ISIN',
        detail: `"${deal.isin}" fails the ISO 6166 Luhn mod-10 check-digit test. Verify against ANNA DSB before publication.`,
        icmaRef: 'ISO 6166 / ANNA DSB',
      });
    }
  }

  // ── 9. ISIN country prefix vs currency ──────────────────────────────────
  if (deal.isin && deal.currency && !checkISINCountryPrefix(deal.isin, deal.currency)) {
    results.push({
      id: 'isin-country-mismatch',
      severity: 'warning',
      field: 'isin',
      title: 'ISIN prefix unusual for currency',
      detail: `ISIN prefix "${deal.isin.slice(0, 2)}" is uncommon for ${deal.currency}-denominated bonds. For Eurobonds, XS is typical; for domestic issues, the issuer's home country code.`,
      icmaRef: 'ISO 6166',
    });
  }

  // ── 10. LEI format ────────────────────────────────────────────────────────
  if (deal.issuerLEI && deal.issuerLEI !== 'TBA') {
    if (!validateLEIFormat(deal.issuerLEI)) {
      results.push({
        id: 'lei-invalid',
        severity: 'error',
        field: 'issuerLEI',
        title: 'Invalid LEI format',
        detail: `"${deal.issuerLEI}" is not a valid GLEIF LEI (must be 20 alphanumeric characters, last 2 numeric). Verify at www.gleif.org.`,
        icmaRef: 'ISO 17442 / GLEIF',
      });
    }
  }

  // ── 11. Size parseable ────────────────────────────────────────────────────
  if (deal.size && deal.size !== 'TBA') {
    const sizeN = parseSize(deal.size);
    if (sizeN === null) {
      results.push({
        id: 'size-unparseable',
        severity: 'error',
        field: 'size',
        title: 'Size not parseable',
        detail: `"${deal.size}" cannot be parsed as a number. Use formats like "2,000,000,000" or "2bn".`,
      });
    } else if (sizeN < 10_000_000) {
      results.push({
        id: 'size-very-small',
        severity: 'info',
        field: 'size',
        title: 'Unusually small issue size',
        detail: `Parsed size of ${sizeN.toLocaleString()} is below €10m — confirm this is not a denomination figure entered as the total size.`,
      });
    }
  }

  // ── 12. Zero coupon with non-zero coupon rate ─────────────────────────────
  if (deal.interestType === 'ZERO_COUPON' && deal.coupon) {
    const c = parseFloat(deal.coupon.replace(/[^0-9.]/g, ''));
    if (!isNaN(c) && c > 0) {
      results.push({
        id: 'zero-coupon-rate-set',
        severity: 'error',
        field: 'coupon',
        title: 'Zero Coupon bond has coupon rate',
        detail: `Interest type is ZERO_COUPON but coupon is set to "${deal.coupon}". Zero coupon bonds should have coupon = 0 or blank.`,
      });
    }
  }

  // ── 13. Day count ↔ interest type consistency ─────────────────────────────
  if (!dayCountConsistentWithType(deal.dayCountFraction, deal.interestType)) {
    results.push({
      id: 'daycount-interesttype-mismatch',
      severity: 'warning',
      field: 'dayCountFraction',
      title: 'Day count / interest type mismatch',
      detail: `${deal.dayCountFraction} is atypical for ${deal.interestType} bonds. Fixed rate Eurobonds conventionally use ACT/ACT (ICMA); floating rate notes use ACT/360 or ACT/365.`,
      icmaRef: 'ICMA Rule 251.1 / ISDA 2006 s.4.16',
    });
  }

  // ── 14. Reoffer yield ↔ coupon sanity ────────────────────────────────────
  if (!checkYieldCouponConsistency(deal.coupon, deal.reofferYield)) {
    results.push({
      id: 'yield-coupon-gap',
      severity: 'warning',
      field: 'reofferYield',
      title: 'Large coupon/yield divergence',
      detail: `Coupon (${deal.coupon}) and reoffer yield (${deal.reofferYield}) differ by more than 3pp. Verify issue price and pricing basis.`,
    });
  }

  // ── 15. Mid-swap + spread → implied yield ────────────────────────────────
  const yieldCheck = checkSpreadYieldImplied(deal.midSwapRate, deal.reofferSpread, deal.reofferYield);
  if (!yieldCheck.ok) {
    results.push({
      id: 'spread-yield-inconsistent',
      severity: 'warning',
      field: 'reofferSpread',
      title: 'Spread + mid-swap ≠ reoffer yield',
      detail: `Mid-swap (${deal.midSwapRate}) + spread (${deal.reofferSpread}) implies ${yieldCheck.implied}, but reoffer yield is ${deal.reofferYield}. Check for stale mid-swap or bps conversion.`,
    });
  }

  // ── 16. Denomination minimum ─────────────────────────────────────────────
  const denomCheck = checkDenomination(deal.specifiedDenomination, deal.listingVenue, deal.sellingRestrictions);
  if (!denomCheck.ok) {
    results.push({
      id: 'denomination-below-minimum',
      severity: 'error',
      field: 'specifiedDenomination',
      title: `Denomination below minimum (${denomCheck.min?.toLocaleString()})`,
      detail: `Minimum specified denomination is ${deal.specifiedDenomination} — below the €/${denomCheck.min?.toLocaleString()} regulatory minimum for this listing / selling restriction combination.`,
      icmaRef: 'Prospectus Regulation / TEFRA / Reg S',
    });
  }

  // ── 17. Common Code format ────────────────────────────────────────────────
  if (deal.commonCode && deal.commonCode !== 'TBA' && !validateCommonCode(deal.commonCode)) {
    results.push({
      id: 'common-code-format',
      severity: 'info',
      field: 'commonCode',
      title: 'Common Code format unusual',
      detail: `Common Code "${deal.commonCode}" is not a standard 6-9 digit Euroclear/Clearstream format. Verify before submission to CSD.`,
    });
  }

  // ── 18. CUSIP format ─────────────────────────────────────────────────────
  if (deal.cusip && deal.cusip !== 'TBA' && !validateCUSIP(deal.cusip)) {
    results.push({
      id: 'cusip-format',
      severity: 'info',
      field: 'cusip',
      title: 'CUSIP format invalid',
      detail: `CUSIP "${deal.cusip}" should be exactly 9 alphanumeric characters. Verify with CUSIP Global Services.`,
    });
  }

  // ── 19. Reoffer price plausibility ───────────────────────────────────────
  if (deal.reofferPrice && deal.reofferPrice !== 'TBA') {
    const p = parseFloat(deal.reofferPrice.replace(/[^0-9.]/g, ''));
    if (!isNaN(p) && (p < 80 || p > 110)) {
      results.push({
        id: 'reoffer-price-extreme',
        severity: 'warning',
        field: 'reofferPrice',
        title: 'Reoffer price out of normal range',
        detail: `Reoffer price of ${deal.reofferPrice} is outside the typical 80–110 range for a new issue. Confirm this is correct.`,
      });
    }
  }

  // ── 20. Floating rate with no spread set ─────────────────────────────────
  if (deal.interestType === 'FLOATING' && (!deal.reofferSpread || deal.reofferSpread === 'TBA')) {
    results.push({
      id: 'floating-no-spread',
      severity: 'warning',
      field: 'reofferSpread',
      title: 'Floating rate: spread not set',
      detail: 'Floating rate notes require a spread over the reference rate (e.g. EURIBOR+150bps). Ensure the final spread is populated before sending.',
    });
  }

  // Sort: errors first, then warnings, then info
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  results.sort((a, b) => order[a.severity] - order[b.severity]);

  return results;
}

// ─── Convenience helpers for the UI ──────────────────────────────────────────

export function countBySeverity(results: ValidationResult[]): Record<Severity, number> {
  return {
    error:   results.filter(r => r.severity === 'error').length,
    warning: results.filter(r => r.severity === 'warning').length,
    info:    results.filter(r => r.severity === 'info').length,
  };
}

/** True when no errors AND no warnings remain */
export function isReadyToPublish(results: ValidationResult[]): boolean {
  return results.every(r => r.severity === 'info');
}
