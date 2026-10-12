import { describe, it, expect } from 'vitest';
import { floatingRateChecks, esgChecks } from '@/lib/conventionChecks';

const P = 'IssuanceDataGroup/';
const st = (f: Record<string, string>, docs: string[] = []) => ({
  f: Object.fromEntries(Object.entries(f).map(([k, v]) => [P + k, v])),
  docs: docs.map(DocumentName => ({ DocumentName })),
});
const titles = (c: { t: string }[]) => c.map(x => x.t);

describe('floating rate conventions', () => {
  it('ignores fixed rate deals', () => {
    expect(floatingRateChecks(st({ 'Product/InterestPayment/InterestType': 'FIXED' }))).toEqual([]);
  });
  it('warns on 30/360 for a EUR FRN', () => {
    const c = floatingRateChecks(st({ 'Product/InterestPayment/InterestType': 'FLOATING', 'Product/AggregateNominalAmount/Currency': 'EUR', 'Product/DayCountFraction': '30/360' }));
    expect(c.find(x => x.t.includes('unusual for EUR'))?.l).toBe('warn');
  });
  it('fails when floor exceeds cap', () => {
    const c = floatingRateChecks(st({ 'Product/InterestPayment/InterestType': 'FLOATING', 'Product/InterestPayment/MinimumRate': '5', 'Product/InterestPayment/MaximumRate': '3' }));
    expect(c.find(x => x.t.startsWith('Minimum rate'))?.l).toBe('fail');
  });
});

describe('reference rate vs currency', () => {
  const frn = (rate: string, ccy: string) => floatingRateChecks({ f: { 'IssuanceDataGroup/Product/InterestPayment/InterestType': 'FLOATING', 'IssuanceDataGroup/Product/AggregateNominalAmount/Currency': ccy, 'x:referenceRate': rate, 'x:floatingMargin': '85' } });
  it('fails SOFR on a EUR deal', () => { expect(frn('SOFR', 'EUR').find(x => x.t.includes('does not suit'))?.l).toBe('fail'); });
  it('passes SONIA on a GBP deal', () => { expect(frn('SONIA', 'GBP').find(x => x.t.includes('suits GBP'))?.l).toBe('pass'); });
});

describe('ESG disclosure', () => {
  it('fails a sustainability-linked bond with no step-up', () => {
    expect(esgChecks(st({ 'Product/ESGLabel': 'SUSTAINABILITY_LINKED' })).find(x => x.l === 'fail')).toBeTruthy();
  });
  it('passes a green bond with framework and SPO cited', () => {
    const c = esgChecks(st({ 'Product/ESGLabel': 'GREEN' }, ['Green Bond Framework', 'Second Party Opinion', 'Allocation report']));
    expect(c.every(x => x.l === 'pass')).toBe(true);
  });
  it('warns when green documents are cited but no label set', () => {
    expect(titles(esgChecks(st({}, ['Green Bond Framework'])))).toContain('ESG documents cited but no ESG label set');
  });
});
