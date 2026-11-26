import { describe, expect, it } from 'vitest';
import { isBusinessDay, suggestMaturity, dateChecks, tenorMonths } from './dates';
import { unifiedChecks, type BdtState } from '../bdt-bridge';
import { withExpected, pricingCompleteness } from '../fieldStatus';
import { buildMsgText } from '../msgFormat';

const MAT = 'IssuanceDataGroup/Product/Maturity/MaturityDate', SD = 'IssuanceDataGroup/Issuance/SettlementDate', PD = 'IssuanceDataGroup/Issuance/PricingDate', CCY = 'IssuanceDataGroup/Issuance/SpecifiedCurrency';
const st = (f: Record<string, string>, stage = 2, fieldMeta?: BdtState['fieldMeta']) => ({ stage, f: { [CCY]: 'EUR', ...f }, parties: [{ PartyName: 'Sasol', Roles: ['ISSUER'] }], ids: [], ratings: [], docs: [], contacts: [], fieldMeta } as unknown as BdtState);
const issues = (c: { l: string; t: string }[]) => c.filter(x => x.l !== 'pass').map(x => x.t);

describe('tenor and maturity', () => {
  it('parses tenors', () => { expect(tenorMonths('10Y')).toBe(120); expect(tenorMonths('long 10Y')).toBe(120); expect(tenorMonths('5.5Y')).toBe(66); expect(tenorMonths('PNC5')).toBeNull(); });
  it('no Deal Checker issue for a 10Y tranche without maturity at IPTs', () => {
    const c = unifiedChecks(st({}, 2), undefined, '10Y').filter(x => x.l !== 'pass');
    expect(c.map(x => `${x.t} ${x.d ?? ''}`).join('\n')).not.toMatch(/maturity/i);
  });
  it('weekend maturity is flagged', () => expect(issues(dateChecks(st({ [MAT]: '2037-01-17' }), '10Y')).join()).toMatch(/Maturity date 2037-01-17 is not a TARGET2 business day/));
  it('holiday calendars beyond hard-coded years', () => { expect(isBusinessDay('2037-12-25', 'TARGET2')).toBe(false); expect(isBusinessDay('2036-07-04', 'US')).toBe(false); expect(isBusinessDay('2037-01-15', 'TARGET2')).toBe(true); });
  it('suggests maturity from settlement + tenor with business-day roll', () => {
    expect(suggestMaturity('2027-01-15', '10Y', 'EUR')!.date).toBe('2037-01-15');
    expect(suggestMaturity('2027-01-16', '10Y', 'EUR')!.date).toBe('2037-01-16');
    expect(suggestMaturity('2026-12-25', '10Y', 'EUR')!.date).toBe('2036-12-29'); // Thu 25th & Fri 26th TARGET2 holidays, weekend → Mon 29th
    const s = withExpected(st({ [SD]: '2026-12-25' }), '10Y');
    expect(s.fieldMeta![MAT]).toMatchObject({ status: 'expected', suggestion: '2036-12-29' });
    expect(s.f[MAT]).toBeUndefined();
  });
  it('tenor/maturity mismatch flagged only when both dates exist', () => {
    expect(issues(dateChecks(st({ [MAT]: '2034-01-16' }), '10Y'))).toEqual([]);
    expect(issues(dateChecks(st({ [SD]: '2027-01-15', [MAT]: '2034-01-16' }), '10Y')).join()).toMatch(/inconsistent with tenor 10Y/);
    expect(issues(dateChecks(st({ [SD]: '2027-01-15', [MAT]: '2037-01-15' }), '10Y'))).toEqual([]);
  });
  it('settlement must follow pricing', () => expect(issues(dateChecks(st({ [PD]: '2027-01-15', [SD]: '2027-01-15' }))).join()).toMatch(/not after the pricing date/));
  it('missing maturity flagged at Priced', () => expect(pricingCompleteness(st({}, 5, {})).map(c => c.d)).toContain(MAT));
  it('MSG shows tenor until maturity is Set, then date with tenor', () => {
    const ws = { version: 1, tranches: [{ id: 'a', label: 'A', currency: 'EUR', amount: 5e8, tenor: '10Y', rateType: 'fixed', values: {} }], plannedTotals: {}, aggregateUsd: null, fx: {} } as never;
    expect(buildMsgText({ state: st({}, 2), ws, borrower: 'Sasol', event: 'ipt' })).toMatch(/^TENOR\s+: 10Y$/m);
    const set = st({ [MAT]: '2037-01-15' }, 5, { [MAT]: { status: 'set', source: 'x', by: '', at: '' } });
    const txt = buildMsgText({ state: set, ws, borrower: 'Sasol', event: 'pricing' });
    expect(txt).toMatch(/^MATURITY\s+: 15-JAN-2037 \(10Y\)$/m);
    expect(txt).not.toMatch(/^TENOR/m);
  });
});
