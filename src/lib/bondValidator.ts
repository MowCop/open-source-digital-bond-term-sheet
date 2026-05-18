/**
 * bondValidator.ts  ·  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop into: src/lib/bondValidator.ts
 *
 * Pure TypeScript — zero runtime dependencies beyond date-fns (already in
 * the project). All check-digit algorithms (ISIN Luhn, LEI MOD 97-10, CUSIP
 * modified Luhn) are inlined so no new npm packages are required.
 *
 * CHANGES FROM v1.0
 * ─────────────────
 * FIX-1  USD settlement corrected to T+1 (SEC rule, effective 28 May 2024).
 * FIX-2  LEI check digit now validated via ISO 17442 / ISO 7064 MOD 97-10.
 * FIX-3  CUSIP check digit now validated via the CUSIP modified-Luhn algorithm.
 * FIX-4  Issue date added to business-day checks (was missing; only settlement
 *         and maturity were tested).
 * FIX-5  Pricing date ≤ issue date check added (blocks reversed-date entries).
 * FIX-6  FRN reference rate field validated (EURIBOR / SOFR / SONIA / ESTR).
 * FIX-7  Governing law ↔ currency consistency check added.
 * FIX-8  dayCountConsistentWithType tightened: 30/360 on EUR FRN and ACT/365
 *         on a fixed-rate Eurobond are now flagged.
 * FIX-9  Holiday-calendar expiry warning: raises an info notice when any date
 *         field extends beyond the last hard-coded calendar year (2027).
 * AUDIT  Master-Admin override logging: validateDeal() accepts an optional
 *         overrideContext; when provided, every blocked Error is annotated with
 *         an audit entry that the caller can persist to AuditLog.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Deal, DayCountFraction, InterestType, InterestPaymentFrequency } from '@/types/bond';

// ─── Result & audit types ─────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  id: string;
  severity: Severity;
  field: string;
  title: string;
  detail: string;
  icmaRef?: string;
  /** Populated when a Master Admin has confirmed an override for this check */
  overriddenBy?: string;
  /** ISO timestamp of the override */
  overriddenAt?: string;
}

/**
 * Pass this context when a Master Admin has explicitly confirmed an override.
 * validateDeal() will annotate blocked Errors with the admin's identity and
 * timestamp so the UI / audit trail can persist those details.
 */
export interface OverrideContext {
  adminUserId: string;
  adminName: string;
  reason: string;
  /** Stable rule IDs that this admin has confirmed overriding */
  overriddenRuleIds: string[];
}

/**
 * Lightweight audit record emitted when an Error-severity rule is overridden.
 * Persist these to your AuditLog store (one entry per overridden rule per send).
 */
export interface DealCheckerAuditEntry {
  ruleId: string;
  ruleTitle: string;
  field: string;
  adminUserId: string;
  adminName: string;
  reason: string;
  dealSnapshot: Partial<Deal>;
  timestamp: string;
}

// ─── Business-day calendar ────────────────────────────────────────────────────
// Hard-coded TARGET2, London bank holidays and US Federal holidays 2024–2027.
// FIX-9: CALENDAR_MAX_YEAR is used to emit a warning when dates exceed coverage.
// Extend each set annually when central banks publish the next-year calendar.

export const CALENDAR_MAX_YEAR = 2027;

const TARGET2_HOLIDAYS = new Set([
  '2024-01-01','2024-03-29','2024-04-01','2024-05-01','2024-12-25','2024-12-26',
  '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-25','2026-12-28',
  '2027-01-01','2027-03-26','2027-03-29','2027-05-01','2027-12-25','2027-12-27',
]);

const LONDON_HOLIDAYS = new Set([
  '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28',
  '2027-01-01','2027-03-26','2027-03-29','2027-05-03','2027-05-31','2027-08-30','2027-12-27','2027-12-28',
]);

const US_HOLIDAYS = new Set([
  '2024-01-01','2024-01-15','2024-02-19','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-10-14','2024-11-11','2024-11-28','2024-12-25',
  '2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25',
  '2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25',
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
  const iso = normalizeISO(dateStr);
  if (!iso) return true; // Unparseable: skip check to avoid false positives
  const d = new Date(iso + 'T12:00:00Z');
  if (isNaN(d.getTime())) return true;
  if (isWeekend(d)) return false;
  return !holidaySet(calendar).has(toISO(d));
}

function calendarForCurrency(currency: string): CalendarKey {
  if (currency === 'GBP') return 'LONDON';
  if (currency === 'USD')  return 'US';
  return 'TARGET2';
}

// Modified Following: advance to next business day unless it crosses a month boundary,
// in which case roll back to the preceding business day (ICMA Rule 251.2).
function modifiedFollowing(dateStr: string, calendar: CalendarKey): string {
  const iso = normalizeISO(dateStr);
  if (!iso) return dateStr;
  const d = new Date(iso + 'T12:00:00Z');
  if (isNaN(d.getTime())) return dateStr;
  const origMonth = d.getUTCMonth();
  let candidate = new Date(d);
  while (!isBusinessDay(toISO(candidate), calendar)) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  if (candidate.getUTCMonth() !== origMonth) {
    candidate = new Date(d);
    while (!isBusinessDay(toISO(candidate), calendar)) {
      candidate.setUTCDate(candidate.getUTCDate() - 1);
    }
  }
  return toISO(candidate);
}

// Normalize a free-form date string ("14 January 2026", "14/01/2026", "2026-01-14",
// "Jan 14, 2026") to ISO yyyy-mm-dd. Returns null if unparseable.
function normalizeISO(s: string | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed || trimmed === 'TBA' || trimmed === 'TBD') return null;
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // dd/mm/yyyy or dd-mm-yyyy (European)
  const eu = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (eu) {
    const [, dd, mm, yyyy] = eu;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // Fall back to JS Date (handles "14 January 2026", "Jan 14, 2026", etc.)
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return toISO(d);
}

// ─── ISIN check-digit  ·  ISO 6166 / Luhn mod-10 ────────────────────────────
// Letters are converted to two-digit numbers (A=10 … Z=35), then the resulting
// digit string is verified with Luhn mod-10.

function validateISIN(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const digits = isin
    .split('')
    .map(c => (c >= 'A' ? (c.charCodeAt(0) - 55).toString() : c))
    .join('');
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

// ─── LEI check-digit  ·  ISO 17442 / ISO 7064 MOD 97-10  ────────────────────
// FIX-2: Inlined MOD 97-10 so no new npm dependency is needed.
// Algorithm: convert alphanumeric chars to digits (A=10…Z=35), then compute
// the remainder of the full numeric string modulo 97; valid LEIs yield 1.

function lei97(lei: string): number {
  // Rearrange: move check digits (last 2) to end — for LEI the full string is
  // passed and we simply verify remainder === 1 per ISO 7064.
  let numeric = '';
  for (const c of lei.toUpperCase()) {
    if (c >= '0' && c <= '9') {
      numeric += c;
    } else if (c >= 'A' && c <= 'Z') {
      numeric += (c.charCodeAt(0) - 55).toString();
    }
  }
  // Process in 9-digit chunks to avoid BigInt (not available in all TS targets)
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = remainder.toString() + numeric.slice(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }
  return remainder;
}

function validateLEIFormat(lei: string): boolean {
  // Structure: 18 alphanumeric + 2 numeric digits
  return /^[A-Z0-9]{18}[0-9]{2}$/.test(lei);
}

function validateLEICheckDigit(lei: string): boolean {
  if (!validateLEIFormat(lei)) return false;
  return lei97(lei) === 1;
}

// ─── CUSIP check-digit  ·  CUSIP modified-Luhn  ─────────────────────────────
// FIX-3: Inlined CUSIP check-digit so no new npm dependency is needed.
// Characters 1-8 are scored (digits 0-9, A-Z → 10-35, * → 36, @ → 37, # → 38);
// even-indexed characters (1-based) are doubled; tens + units are summed;
// check digit = (10 − (sum mod 10)) mod 10 = character 9.

function cusipCheckDigit(first8: string): number {
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*@#';
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const c = first8[i].toUpperCase();
    let v = CHARS.indexOf(c);
    if (v === -1) return -1; // invalid character
    if ((i + 1) % 2 === 0) v *= 2; // 1-based even position
    sum += Math.floor(v / 10) + (v % 10);
  }
  return (10 - (sum % 10)) % 10;
}

function validateCUSIP(cusip: string | undefined): boolean {
  if (!cusip) return true;
  const c = cusip.trim().toUpperCase();
  if (!/^[0-9A-Z*@#]{9}$/.test(c)) return false;
  const computed = cusipCheckDigit(c.slice(0, 8));
  if (computed === -1) return false;
  return computed === parseInt(c[8], 10);
}

// ─── Common Code format ───────────────────────────────────────────────────────

function validateCommonCode(cc: string | undefined): boolean {
  if (!cc) return true;
  return /^\d{6,9}$/.test(cc.trim());
}

// ─── LEI format (GLEIF) ───────────────────────────────────────────────────────

// ─── Size parser ──────────────────────────────────────────────────────────────
// Handles: '2,000,000,000' · '2bn' · 'U.S.$1bn' · 'EUR 500m' · '500M' · '2B'

function parseSize(raw: string): number | null {
  // Strip common currency prefixes: USD, EUR, GBP, U.S.$, $, €, £
  const stripped = raw.replace(/^(U\.S\.\$|USD|EUR|GBP|CHF|\$|€|£)\s*/i, '').replace(/[, ]/g, '');
  const multipliers: Record<string, number> = {
    bn: 1e9, b: 1e9, billion: 1e9,
    mm: 1e6, m: 1e6, million: 1e6,
    k: 1e3, thousand: 1e3,
  };
  const match = stripped.match(/^([\d.]+)(bn|b|billion|mm|million|m|k|thousand)?$/i);
  if (!match) return null;
  const base = parseFloat(match[1]);
  const mult = match[2] ? multipliers[match[2].toLowerCase()] : 1;
  return base * (mult ?? 1);
}

// ─── Date utilities ───────────────────────────────────────────────────────────

function parseDate(s: string | undefined): Date | null {
  const iso = normalizeISO(s);
  if (!iso) return null;
  const d = new Date(iso + 'T12:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// FIX-9 helper: returns true when a date string's year exceeds our calendar coverage
function beyondCalendarCoverage(dateStr: string | undefined): boolean {
  if (!dateStr || dateStr === 'TBA') return false;
  const d = parseDate(dateStr);
  if (!d) return false;
  return d.getUTCFullYear() > CALENDAR_MAX_YEAR;
}

// ─── Tenor → approximate days ─────────────────────────────────────────────────

function tenorToDays(tenor: string): number | null {
  const mY = tenor.trim().match(/^(\d+)\s*Y$/i);
  if (mY) return parseInt(mY[1], 10) * 365;
  const mM = tenor.trim().match(/^(\d+)\s*M$/i);
  if (mM) return parseInt(mM[1], 10) * 30;
  return null;
}

// ─── Coupon date generator ─────────────────────────────────────────────────────

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

// ─── Day count ↔ interest type consistency  (FIX-8: tightened) ───────────────
// Eurobond fixed-rate: ACT/ACT (ICMA convention).
// Floating-rate notes: ACT/360 (€/$ LIBOR/EURIBOR) or ACT/365 (SONIA/ESTR).
// 30/360 on a EUR FRN and ACT/365 on a fixed Eurobond are flagged.

function dayCountConsistentWithType(
  dcf: DayCountFraction | undefined,
  iType: InterestType | undefined,
): boolean {
  if (!dcf || !iType) return true;
  if (iType === 'ZERO_COUPON') return true;
  // Floating: ACT/ACT is wrong; 30/360 on a FRN is also unusual
  if (iType === 'FLOATING' && (dcf === 'ACT_ACT' || dcf === '30_360' || dcf === '30E_360')) return false;
  // Fixed Eurobond: ACT/360 and ACT/365 are both wrong
  if (iType === 'FIXED' && (dcf === 'ACT_360' || dcf === 'ACT_365')) return false;
  return true;
}

// ─── Settlement T+N convention  (FIX-1: USD is now T+1) ─────────────────────

function expectedSettlementDays(currency: string): number {
  // USD: T+1 per SEC Final Rule effective 28 May 2024.
  // EUR / GBP / CHF: T+2 (CSDR Art. 5(2)); EU T+1 migration targeted Oct 2027.
  if (currency === 'USD') return 1;
  return 2;
}

// ─── Reoffer yield ↔ coupon sanity ────────────────────────────────────────────

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

// ─── Mid-swap + spread → implied yield  ──────────────────────────────────────
// FIX: spread parsing now correctly handles negative spreads (e.g. -5bps).

function checkSpreadYieldImplied(
  midSwap: string | undefined,
  spread: string | undefined,
  reofferYield: string | undefined,
): { ok: boolean; implied?: string } {
  if (!midSwap || !spread || !reofferYield) return { ok: true };
  const ms = parseFloat(midSwap.replace('%', '').replace(/[^\d.\-]/g, ''));
  // Parse spread: allow leading minus and optional 'bps' suffix
  const spreadClean = spread.replace(/bps|bp/i, '').trim();
  const sp = parseFloat(spreadClean) / 100; // bps → %
  const ry = parseFloat(reofferYield.replace('%', '').replace(/[^\d.]/g, ''));
  if (isNaN(ms) || isNaN(sp) || isNaN(ry)) return { ok: true };
  const implied = ms + sp;
  return { ok: Math.abs(implied - ry) < 0.05, implied: implied.toFixed(3) + '%' };
}

// ─── Denomination check ───────────────────────────────────────────────────────

function checkDenomination(
  denom: string | undefined,
  listingVenue: string | undefined,
  sellingRestrictions: string | undefined,
): { ok: boolean; min?: number } {
  if (!denom) return { ok: true };
  const n = parseFloat(denom.replace(/[, ]/g, ''));
  if (isNaN(n)) return { ok: true };
  const is144A = sellingRestrictions?.toLowerCase().includes('144a');
  const min = is144A ? 200_000 : 100_000;
  return { ok: n >= min, min };
}

// ─── ISIN country prefix consistency ─────────────────────────────────────────

const CCY_TO_LIKELY_COUNTRY: Record<string, string[]> = {
  EUR: ['XS','DE','FR','IT','ES','NL','BE','AT','PT','FI','IE','LU'],
  GBP: ['XS','GB'],
  USD: ['US','XS'],
  CHF: ['CH','XS'],
  JPY: ['JP','XS'],
  AUD: ['AU','XS'],
};

function checkISINCountryPrefix(isin: string | undefined, currency: string | undefined): boolean {
  if (!isin || !currency) return true;
  const prefix = isin.slice(0, 2);
  const allowed = CCY_TO_LIKELY_COUNTRY[currency];
  if (!allowed) return true;
  return allowed.includes(prefix);
}

// ─── FRN reference rate recognition  (FIX-6) ─────────────────────────────────
// Common reference rates. Extend as new RFRs emerge.

const KNOWN_REFERENCE_RATES = [
  'EURIBOR','SOFR','SONIA','ESTR','€STR','LIBOR','TONA','CORRA','SARON','HICP',
];

function isKnownReferenceRate(rate: string | undefined): boolean {
  if (!rate) return false;
  return KNOWN_REFERENCE_RATES.some(r => rate.toUpperCase().includes(r));
}

// ─── Governing law ↔ currency consistency  (FIX-7) ───────────────────────────

function checkGoverningLawCurrency(
  governingLaw: string | undefined,
  currency: string | undefined,
  sellingRestrictions: string | undefined,
): { ok: boolean; detail?: string } {
  if (!governingLaw || !currency) return { ok: true };
  // USD bonds typically use New York law; non-US under English law is unusual but valid
  if (currency === 'USD' && governingLaw === 'ENGLISH_LAW') {
    return {
      ok: false,
      detail: `USD-denominated bonds conventionally use New York law. English law on a USD bond is uncommon — confirm this is intentional.`,
    };
  }
  // Reg S without 144A should not typically use New York law
  const has144A = sellingRestrictions?.toLowerCase().includes('144a');
  const hasRegS = sellingRestrictions?.toLowerCase().includes('reg s');
  if (!has144A && hasRegS && governingLaw === 'NEW_YORK_LAW') {
    return {
      ok: false,
      detail: `New York governing law on a pure Reg S bond (without Rule 144A) is unusual. Confirm selling restrictions and governing law are consistent.`,
    };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export function validateDeal(
  deal: Partial<Deal>,
  overrideContext?: OverrideContext,
): { results: ValidationResult[]; auditEntries: DealCheckerAuditEntry[] } {
  const results: ValidationResult[] = [];
  const auditEntries: DealCheckerAuditEntry[] = [];
  const cal = calendarForCurrency(deal.currency ?? 'EUR');

  // Helper: push a result, applying override annotation if the admin has cleared this rule
  function push(result: ValidationResult): void {
    if (
      result.severity === 'error' &&
      overrideContext?.overriddenRuleIds.includes(result.id)
    ) {
      // Downgrade to warning so it no longer blocks; annotate with admin identity
      result = {
        ...result,
        severity: 'warning',
        overriddenBy: overrideContext.adminUserId,
        overriddenAt: new Date().toISOString(),
        detail: `[OVERRIDDEN by ${overrideContext.adminName}] ${result.detail} — Reason: ${overrideContext.reason}`,
      };
      auditEntries.push({
        ruleId: result.id,
        ruleTitle: result.title,
        field: result.field,
        adminUserId: overrideContext.adminUserId,
        adminName: overrideContext.adminName,
        reason: overrideContext.reason,
        dealSnapshot: { ...deal },
        timestamp: result.overriddenAt!,
      });
    }
    results.push(result);
  }

  // ── FIX-9: Calendar coverage warning ────────────────────────────────────────
  const datesToCheck = [deal.settlementDate, deal.maturityDate, deal.issueDate, deal.pricingDate];
  const beyondCoverage = datesToCheck.some(beyondCalendarCoverage);
  if (beyondCoverage) {
    push({
      id: 'calendar-coverage',
      severity: 'info',
      field: 'maturityDate',
      title: `Holiday calendar ends ${CALENDAR_MAX_YEAR}`,
      detail: `One or more dates extend beyond ${CALENDAR_MAX_YEAR}, the last year covered by the hard-coded holiday sets. Business-day checks for those dates may be inaccurate. Update TARGET2_HOLIDAYS, LONDON_HOLIDAYS and US_HOLIDAYS in bondValidator.ts before any deal settling after 31 Dec ${CALENDAR_MAX_YEAR}.`,
    });
  }

  // ── 1. Settlement date: weekend / holiday ────────────────────────────────────
  if (deal.settlementDate && deal.settlementDate !== 'TBA') {
    const isoSettle = normalizeISO(deal.settlementDate);
    if (isoSettle && !isBusinessDay(isoSettle, cal)) {
      const adjusted = modifiedFollowing(deal.settlementDate, cal);
      push({
        id: 'settlement-non-business',
        severity: 'error',
        field: 'settlementDate',
        title: 'Settlement on non-business day',
        detail: `Settlement date ${deal.settlementDate} (${isoSettle}) falls on a weekend or ${cal} holiday. Modified Following convention suggests ${adjusted}.`,
        icmaRef: 'ICMA Rule 251.2 / Business Day Convention',
      });
    }
  }

  // ── 2. Maturity date: weekend / holiday ──────────────────────────────────────
  if (deal.maturityDate && deal.maturityDate !== 'TBA') {
    if (!isBusinessDay(deal.maturityDate, cal)) {
      const adjusted = modifiedFollowing(deal.maturityDate, cal);
      push({
        id: 'maturity-non-business',
        severity: 'error',
        field: 'maturityDate',
        title: 'Maturity on non-business day',
        detail: `Maturity date ${deal.maturityDate} is not a ${cal} business day. Adjusted date would be ${adjusted}.`,
        icmaRef: 'ICMA Rule 251.2',
      });
    }
  }

  // ── FIX-4: Issue date: weekend / holiday ─────────────────────────────────────
  if (deal.issueDate && deal.issueDate !== 'TBA') {
    if (!isBusinessDay(deal.issueDate, cal)) {
      const adjusted = modifiedFollowing(deal.issueDate, cal);
      push({
        id: 'issue-non-business',
        severity: 'error',
        field: 'issueDate',
        title: 'Issue date on non-business day',
        detail: `Issue date ${deal.issueDate} falls on a weekend or ${cal} holiday. Modified Following convention suggests ${adjusted}.`,
        icmaRef: 'ICMA Rule 251.2',
      });
    }
  }

  // ── 3. Pricing date: weekend / holiday ───────────────────────────────────────
  if (deal.pricingDate && deal.pricingDate !== 'TBA') {
    if (!isBusinessDay(deal.pricingDate, cal)) {
      push({
        id: 'pricing-non-business',
        severity: 'warning',
        field: 'pricingDate',
        title: 'Pricing on non-business day',
        detail: `Pricing date ${deal.pricingDate} is a weekend or public holiday. Confirm this is intentional.`,
      });
    }
  }

  // ── FIX-5: Pricing date must not be after issue date ──────────────────────────
  const pricingD = parseDate(deal.pricingDate);
  const issueDforPricing = parseDate(deal.issueDate);
  if (pricingD && issueDforPricing && pricingD > issueDforPricing) {
    push({
      id: 'pricing-after-issue',
      severity: 'error',
      field: 'pricingDate',
      title: 'Pricing date after issue date',
      detail: `Pricing date (${deal.pricingDate}) is after issue date (${deal.issueDate}). Bonds price before or on the issue date.`,
    });
  }

  // ── 4. Coupon payment dates: weekend / holiday ───────────────────────────────
  if (deal.issueDate && deal.issueDate !== 'TBA' && deal.interestPaymentFrequency && deal.interestType !== 'ZERO_COUPON') {
    const couponDates = generateCouponDates(deal.issueDate, deal.interestPaymentFrequency, 4);
    const badDates = couponDates.filter(d => !isBusinessDay(d, cal));
    if (badDates.length > 0) {
      const adjConv = deal.businessDayConvention ?? 'not specified';
      push({
        id: 'coupon-dates-non-business',
        severity: 'warning',
        field: 'interestPaymentFrequency',
        title: 'Coupon dates fall on non-business days',
        detail: `${badDates.length} of the first 4 coupon dates (${badDates.join(', ')}) are non-${cal} business days. Business day convention is ${adjConv}.`,
        icmaRef: 'ICMA Rule 251.1(iii)',
      });
    }
  }

  // ── 5. Maturity date after issue date ────────────────────────────────────────
  const issueD = parseDate(deal.issueDate);
  const maturityD = parseDate(deal.maturityDate);
  if (issueD && maturityD) {
    if (maturityD <= issueD) {
      push({
        id: 'maturity-before-issue',
        severity: 'error',
        field: 'maturityDate',
        title: 'Maturity not after issue date',
        detail: `Maturity date (${deal.maturityDate}) must be strictly after issue date (${deal.issueDate}).`,
      });
    }
  }

  // ── 6. Tenor ↔ maturity consistency ─────────────────────────────────────────
  if (issueD && maturityD && deal.tenor) {
    const expectedDays = tenorToDays(deal.tenor);
    const actualDays = diffDays(issueD, maturityD);
    if (expectedDays !== null && Math.abs(actualDays - expectedDays) > 14) {
      push({
        id: 'tenor-maturity-mismatch',
        severity: 'warning',
        field: 'tenor',
        title: 'Tenor/maturity mismatch',
        detail: `Stated tenor is ${deal.tenor} (~${expectedDays} days) but issue→maturity is ${actualDays} days. Difference of ${Math.abs(actualDays - expectedDays)} days — please verify.`,
      });
    }
  }

  // ── 7. Settlement = issue + T+N  (FIX-1: USD now uses T+1) ──────────────────
  const settlementD = parseDate(deal.settlementDate);
  if (issueD && settlementD && deal.currency) {
    const expectedT = expectedSettlementDays(deal.currency);
    const actualT = diffDays(issueD, settlementD);
    if (actualT !== expectedT && actualT !== 0) {
      push({
        id: 'settlement-convention',
        severity: 'warning',
        field: 'settlementDate',
        title: `Settlement not T+${expectedT}`,
        detail: `For ${deal.currency} bonds, standard settlement is T+${expectedT}. Issue date ${deal.issueDate} implies settlement ${toISO(new Date(issueD.getTime() + expectedT * 86_400_000))}, but ${deal.settlementDate} is T+${actualT}.`,
        icmaRef: 'ICMA / CSDR Settlement Discipline',
      });
    }
  }

  // ── 8. ISIN check-digit ──────────────────────────────────────────────────────
  if (deal.isin && deal.isin !== 'TBA') {
    if (!validateISIN(deal.isin)) {
      push({
        id: 'isin-invalid',
        severity: 'error',
        field: 'isin',
        title: 'Invalid ISIN',
        detail: `"${deal.isin}" fails the ISO 6166 Luhn mod-10 check-digit test. Verify against ANNA DSB before publication.`,
        icmaRef: 'ISO 6166 / ANNA DSB',
      });
    }
  }

  // ── 9. ISIN country prefix vs currency ──────────────────────────────────────
  if (deal.isin && deal.currency && !checkISINCountryPrefix(deal.isin, deal.currency)) {
    push({
      id: 'isin-country-mismatch',
      severity: 'warning',
      field: 'isin',
      title: 'ISIN prefix unusual for currency',
      detail: `ISIN prefix "${deal.isin.slice(0, 2)}" is uncommon for ${deal.currency}-denominated bonds. For Eurobonds XS is typical; for domestic issues the issuer's home country code applies.`,
      icmaRef: 'ISO 6166',
    });
  }

  // ── 10. LEI format + check digit  (FIX-2) ───────────────────────────────────
  if (deal.issuerLEI && deal.issuerLEI !== 'TBA') {
    if (!validateLEIFormat(deal.issuerLEI)) {
      push({
        id: 'lei-invalid',
        severity: 'error',
        field: 'issuerLEI',
        title: 'Invalid LEI format',
        detail: `"${deal.issuerLEI}" is not a valid GLEIF LEI (must be 20 alphanumeric characters, last 2 numeric). Verify at www.gleif.org.`,
        icmaRef: 'ISO 17442 / GLEIF',
      });
    } else if (!validateLEICheckDigit(deal.issuerLEI)) {
      push({
        id: 'lei-check-digit',
        severity: 'error',
        field: 'issuerLEI',
        title: 'LEI check digits invalid',
        detail: `"${deal.issuerLEI}" passes format validation but fails the ISO 17442 MOD 97-10 check-digit test — likely a transcription error. Verify the exact LEI at www.gleif.org/en/lei-data/gleif-lei-search.`,
        icmaRef: 'ISO 17442 / ISO 7064 MOD 97-10',
      });
    }
  }

  // ── 11. Size parseable ───────────────────────────────────────────────────────
  if (deal.size && deal.size !== 'TBA') {
    const sizeN = parseSize(deal.size);
    if (sizeN === null) {
      push({
        id: 'size-unparseable',
        severity: 'error',
        field: 'size',
        title: 'Size not parseable',
        detail: `"${deal.size}" cannot be parsed as a number. Use formats like "2,000,000,000", "EUR 2bn" or "2B".`,
      });
    } else if (sizeN < 10_000_000) {
      push({
        id: 'size-very-small',
        severity: 'info',
        field: 'size',
        title: 'Unusually small issue size',
        detail: `Parsed size of ${sizeN.toLocaleString()} is below €10m — confirm this is not a denomination figure entered as the total size.`,
      });
    }
  }

  // ── 12. Zero coupon with non-zero coupon rate ─────────────────────────────────
  if (deal.interestType === 'ZERO_COUPON' && deal.coupon) {
    const c = parseFloat(deal.coupon.replace(/[^0-9.]/g, ''));
    if (!isNaN(c) && c > 0) {
      push({
        id: 'zero-coupon-rate-set',
        severity: 'error',
        field: 'coupon',
        title: 'Zero Coupon bond has coupon rate',
        detail: `Interest type is ZERO_COUPON but coupon is set to "${deal.coupon}". Zero coupon bonds should have coupon = 0 or blank.`,
      });
    }
  }

  // ── 13. Day count ↔ interest type consistency  (FIX-8: tightened) ────────────
  if (!dayCountConsistentWithType(deal.dayCountFraction, deal.interestType)) {
    push({
      id: 'daycount-interesttype-mismatch',
      severity: 'warning',
      field: 'dayCountFraction',
      title: 'Day count / interest type mismatch',
      detail: `${deal.dayCountFraction} is atypical for ${deal.interestType} bonds. Fixed rate Eurobonds conventionally use ACT/ACT (ICMA); floating rate notes use ACT/360 or ACT/365. 30/360 on a FRN and ACT/365 on a fixed Eurobond are non-standard.`,
      icmaRef: 'ICMA Rule 251.1 / ISDA 2006 s.4.16',
    });
  }

  // ── 14. Reoffer yield ↔ coupon sanity ────────────────────────────────────────
  if (!checkYieldCouponConsistency(deal.coupon, deal.reofferYield)) {
    push({
      id: 'yield-coupon-gap',
      severity: 'warning',
      field: 'reofferYield',
      title: 'Large coupon/yield divergence',
      detail: `Coupon (${deal.coupon}) and reoffer yield (${deal.reofferYield}) differ by more than 3pp. Verify issue price and pricing basis.`,
    });
  }

  // ── 15. Mid-swap + spread → implied yield ────────────────────────────────────
  const yieldCheck = checkSpreadYieldImplied(deal.midSwapRate, deal.reofferSpread, deal.reofferYield);
  if (!yieldCheck.ok) {
    push({
      id: 'spread-yield-inconsistent',
      severity: 'warning',
      field: 'reofferSpread',
      title: 'Spread + mid-swap ≠ reoffer yield',
      detail: `Mid-swap (${deal.midSwapRate}) + spread (${deal.reofferSpread}) implies ${yieldCheck.implied}, but reoffer yield is ${deal.reofferYield}. Check for stale mid-swap snapshot or bps conversion error.`,
    });
  }

  // ── 16. Denomination minimum ─────────────────────────────────────────────────
  const denomCheck = checkDenomination(deal.specifiedDenomination, deal.listingVenue, deal.sellingRestrictions);
  if (!denomCheck.ok) {
    push({
      id: 'denomination-below-minimum',
      severity: 'error',
      field: 'specifiedDenomination',
      title: `Denomination below minimum (${denomCheck.min?.toLocaleString()})`,
      detail: `Minimum specified denomination is ${deal.specifiedDenomination} — below the €/${denomCheck.min?.toLocaleString()} regulatory minimum for this listing / selling restriction combination.`,
      icmaRef: 'Prospectus Regulation / TEFRA / Reg S',
    });
  }

  // ── 17. Common Code format ────────────────────────────────────────────────────
  if (deal.commonCode && deal.commonCode !== 'TBA' && !validateCommonCode(deal.commonCode)) {
    push({
      id: 'common-code-format',
      severity: 'info',
      field: 'commonCode',
      title: 'Common Code format unusual',
      detail: `Common Code "${deal.commonCode}" is not a standard 6-9 digit Euroclear/Clearstream format. Verify before submission to CSD.`,
    });
  }

  // ── 18. CUSIP check-digit  (FIX-3) ───────────────────────────────────────────
  if (deal.cusip && deal.cusip !== 'TBA') {
    if (!validateCUSIP(deal.cusip)) {
      push({
        id: 'cusip-invalid',
        severity: 'info',
        field: 'cusip',
        title: 'CUSIP check digit invalid',
        detail: `CUSIP "${deal.cusip}" fails the modified-Luhn check-digit test or contains an invalid character. Verify with CUSIP Global Services.`,
      });
    }
  }

  // ── 19. Reoffer price plausibility ────────────────────────────────────────────
  if (deal.reofferPrice && deal.reofferPrice !== 'TBA') {
    const p = parseFloat(deal.reofferPrice.replace(/[^0-9.]/g, ''));
    if (!isNaN(p) && (p < 80 || p > 110)) {
      push({
        id: 'reoffer-price-extreme',
        severity: 'warning',
        field: 'reofferPrice',
        title: 'Reoffer price out of normal range',
        detail: `Reoffer price of ${deal.reofferPrice} is outside the typical 80–110 range for a new issue. Confirm this is correct.`,
      });
    }
  }

  // ── 20. Floating rate with no spread set ─────────────────────────────────────
  if (deal.interestType === 'FLOATING' && (!deal.reofferSpread || deal.reofferSpread === 'TBA')) {
    push({
      id: 'floating-no-spread',
      severity: 'warning',
      field: 'reofferSpread',
      title: 'Floating rate: spread not set',
      detail: 'Floating rate notes require a spread over the reference rate (e.g. EURIBOR+150bps). Ensure the final spread is populated before sending.',
    });
  }

  // ── FIX-6: FRN reference rate validation ─────────────────────────────────────
  if (deal.interestType === 'FLOATING') {
    // The Deal type has interestRate which is used as the reference rate field for FRNs
    const rateField = (deal as any).referenceRate ?? deal.interestRate;
    if (!rateField || !isKnownReferenceRate(rateField)) {
      push({
        id: 'frn-no-reference-rate',
        severity: 'warning',
        field: 'interestRate',
        title: 'FRN: reference rate not identified',
        detail: `Floating rate notes must specify a benchmark reference rate (e.g. EURIBOR, SOFR, SONIA, ESTR). No recognised rate was found in the interest rate field ("${rateField ?? 'blank'}"). Populate before publication.`,
        icmaRef: 'ICMA BDT / ISDA 2006 Definitions',
      });
    }
  }

  // ── FIX-7: Governing law ↔ currency consistency ───────────────────────────────
  const lawCheck = checkGoverningLawCurrency(deal.governingLaw, deal.currency, deal.sellingRestrictions);
  if (!lawCheck.ok) {
    push({
      id: 'governing-law-currency',
      severity: 'warning',
      field: 'governingLaw',
      title: 'Governing law / currency mismatch',
      detail: lawCheck.detail ?? 'Unusual governing law for this currency. Please confirm.',
      icmaRef: 'ICMA BDT / Prospectus Regulation',
    });
  }

  // Sort: errors first, then warnings, then info
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  results.sort((a, b) => order[a.severity] - order[b.severity]);

  return { results, auditEntries };
}

// ─── Convenience helpers for the UI ──────────────────────────────────────────

export function countBySeverity(results: ValidationResult[]): Record<Severity, number> {
  return {
    error:   results.filter(r => r.severity === 'error').length,
    warning: results.filter(r => r.severity === 'warning').length,
    info:    results.filter(r => r.severity === 'info').length,
  };
}

/** True when no un-overridden errors AND no warnings remain */
export function isReadyToPublish(results: ValidationResult[]): boolean {
  return results.every(r => r.severity === 'info');
}
