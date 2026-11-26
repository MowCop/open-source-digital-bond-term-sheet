/** Rule-based business-day calendars (any year) and tenor/maturity helpers. Pure. */
import type { BdtState, CheckItem } from '../bdt-bridge';
import type { DealWorkspace } from '../dealWorkspace';

export type Calendar = 'TARGET2' | 'US' | 'LONDON';
export const calendarFor = (ccy: string): Calendar => ccy === 'USD' ? 'US' : ccy === 'GBP' ? 'LONDON' : 'TARGET2';
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
function easter(y: number) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31) - 1, da = ((h + l - 7 * m + 114) % 31) + 1; return utc(y, mo, da); }
const add = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const nth = (y: number, m: number, dow: number, n: number) => { const first = utc(y, m, 1); return add(first, ((dow - first.getUTCDay() + 7) % 7) + (n - 1) * 7); };
const last = (y: number, m: number, dow: number) => { const end = utc(y, m + 1, 0); return add(end, -((end.getUTCDay() - dow + 7) % 7)); };
const observed = (d: Date) => d.getUTCDay() === 6 ? add(d, -1) : d.getUTCDay() === 0 ? add(d, 1) : d;
const cache = new Map<string, Set<string>>();
export function holidays(cal: Calendar, y: number): Set<string> {
  const key = cal + y; if (cache.has(key)) return cache.get(key)!;
  const e = easter(y), s = new Set<string>();
  if (cal === 'TARGET2') [utc(y, 0, 1), add(e, -2), add(e, 1), utc(y, 4, 1), utc(y, 11, 25), utc(y, 11, 26)].forEach(d => s.add(iso(d)));
  if (cal === 'LONDON') {
    const ny = utc(y, 0, 1); s.add(iso(ny.getUTCDay() === 6 ? add(ny, 2) : ny.getUTCDay() === 0 ? add(ny, 1) : ny));
    [add(e, -2), add(e, 1), nth(y, 4, 1, 1), last(y, 4, 1), last(y, 7, 1)].forEach(d => s.add(iso(d)));
    const xm = utc(y, 11, 25), bx = utc(y, 11, 26), w = xm.getUTCDay();
    s.add(iso(w === 6 || w === 0 ? add(xm, 2) : xm)); s.add(iso(w === 5 || w === 6 ? add(bx, 2) : w === 0 ? add(bx, 1) : bx));
  }
  if (cal === 'US') {
    [utc(y, 0, 1), utc(y, 5, 19), utc(y, 6, 4), utc(y, 10, 11), utc(y, 11, 25)].forEach(d => s.add(iso(observed(d))));
    [nth(y, 0, 1, 3), nth(y, 1, 1, 3), last(y, 4, 1), nth(y, 8, 1, 1), nth(y, 9, 1, 2), nth(y, 10, 4, 4)].forEach(d => s.add(iso(d)));
  }
  cache.set(key, s); return s;
}
export function isBusinessDay(date: string, cal: Calendar) {
  const d = new Date(date + 'T00:00:00Z'); if (isNaN(d.getTime())) return true;
  return d.getUTCDay() % 6 !== 0 && !holidays(cal, d.getUTCFullYear()).has(date);
}
/** Modified Following (ICMA Rule 251.2). */
export function rollModifiedFollowing(date: string, cal: Calendar) {
  let d = date; while (!isBusinessDay(d, cal)) d = iso(add(new Date(d + 'T00:00:00Z'), 1));
  if (d.slice(0, 7) !== date.slice(0, 7)) { d = date; while (!isBusinessDay(d, cal)) d = iso(add(new Date(d + 'T00:00:00Z'), -1)); }
  return d;
}
/** "10Y", "long 10Y", "5.5Y", "18M" → months; perpetual "PNC5" has no maturity. */
export function tenorMonths(tenor: string): number | null {
  const t = (tenor ?? '').trim();
  if (!t || /\b(PNC|perp)/i.test(t)) return null;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(y|yr|year|years|m|mo|month|months)?\b/i);
  if (!m) return null;
  return Math.round(Number(m[1]) * (/^m/i.test(m[2] ?? '') ? 1 : 12));
}
export function addMonths(date: string, months: number) {
  const d = new Date(date + 'T00:00:00Z'), y = d.getUTCFullYear(), mo = d.getUTCMonth() + months, day = d.getUTCDate();
  const end = utc(y, mo + 1, 0).getUTCDate(); return iso(utc(y, mo, Math.min(day, end)));
}
/** Settlement + tenor, rolled Modified Following on the currency calendar. */
export function suggestMaturity(settlement: string, tenor: string, ccy: string): { date: string; why: string } | null {
  const months = tenorMonths(tenor); if (!months || !/^\d{4}-\d{2}-\d{2}$/.test(settlement)) return null;
  const cal = calendarFor(ccy), raw = addMonths(settlement, months), date = rollModifiedFollowing(raw, cal);
  return { date, why: `Settlement ${settlement} + ${tenor}${date !== raw ? `, rolled Modified Following on ${cal}` : ''} (ICMA Rule 251.2; confirm against the final terms).` };
}
export const MSG_DATE = (d: string) => { const x = new Date(d + 'T00:00:00Z'); return isNaN(x.getTime()) ? d : `${String(x.getUTCDate()).padStart(2, '0')}-${x.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase()}-${x.getUTCFullYear()}`; };

const P = 'IssuanceDataGroup/';
/** Date checks only when the dates exist — absent dates are never issues. */
export function dateChecks(state: BdtState, tenor?: string, label = ''): CheckItem[] {
  const f = state.f, out: CheckItem[] = [], ccy = f[P + 'Issuance/SpecifiedCurrency'] || 'EUR', cal = calendarFor(ccy), pre = label ? `${label}: ` : '';
  const dates: [string, string][] = [['Maturity date', P + 'Product/Maturity/MaturityDate'], ['Settlement date', P + 'Issuance/SettlementDate'], ['Issue date', P + 'Issuance/IssueDate'], ['Pricing date', P + 'Issuance/PricingDate'], ['First coupon date', P + 'Product/InterestPayment/FixedRatePayment/InterestPayments/FirstInterestPaymentDate']];
  for (const [l, p] of dates) { const v = f[p]?.trim(); if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isBusinessDay(v, cal)) out.push({ l: 'warn', src: 'vdr', t: `${pre}${l} ${v} is not a ${cal} business day`, d: `Modified Following would give ${rollModifiedFollowing(v, cal)} (ICMA Rule 251.2).` }); }
  const pd = f[P + 'Issuance/PricingDate'], sd = f[P + 'Issuance/SettlementDate'] || f[P + 'Issuance/IssueDate'], md = f[P + 'Product/Maturity/MaturityDate'];
  if (pd && sd && sd <= pd) out.push({ l: 'fail', src: 'vdr', t: `${pre}Settlement is not after the pricing date` });
  const months = tenorMonths(tenor ?? '');
  if (md && sd && months) {
    const expected = addMonths(sd, months), diff = Math.abs((Date.parse(md) - Date.parse(expected)) / 864e5);
    if (diff > 5) out.push({ l: 'warn', src: 'vdr', t: `${pre}Maturity ${md} is inconsistent with tenor ${tenor}`, d: `Settlement + ${tenor} is ${expected}; allow a few days for business-day roll.` });
  }
  return out;
}
/** Tenor until maturity is Set: "15-JAN-2037 (10Y)". */
export function maturityText(state: BdtState, tenor: string) {
  const md = state.f[P + 'Product/Maturity/MaturityDate']?.trim();
  return md ? `${MSG_DATE(md)}${tenor ? ` (${tenor.toUpperCase()})` : ''}` : '';
}
export type { DealWorkspace };
