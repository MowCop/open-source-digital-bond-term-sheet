import { describe, it, expect } from 'vitest';
import { trancheFields, trancheValue } from './trancheFields';

const FL = 'IssuanceDataGroup/Product/InterestPayment/FloatingRatePayment/';
const COUPON = 'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate';
const CCY = 'IssuanceDataGroup/Issuance/SpecifiedCurrency';
const LAW = 'IssuanceDataGroup/Issuance/GoverningLaw/CountryCode';
const MAT = 'IssuanceDataGroup/Product/Maturity/MaturityDate';

describe('tranche field selection', () => {
  it('fixed tranche shows coupon but no floating terms', () => {
    const ps = trancheFields('fixed').map(r => r.p);
    expect(ps).toContain(COUPON);
    expect(ps.some(p => p.startsWith(FL))).toBe(false);
  });
  it('floating tranche shows reference rate and spread but no fixed coupon', () => {
    const ps = trancheFields('floating').map(r => r.p);
    expect(ps).toContain(FL + 'Benchmark/BenchmarkCode');
    expect(ps).toContain(FL + 'Spread/Value');
    expect(ps).not.toContain(COUPON);
  });
  it('every selected field exists in the BDT dictionary', () => {
    expect(trancheFields('floating', 'at1').every(r => r.fd)).toBe(true);
  });
  it('preference only shows for senior preferred / non-preferred', () => {
    const pref = 'IssuanceDataGroup/Product/StatusOfNote/Preferred';
    expect(trancheFields('fixed', 'senior_unsecured').map(r => r.p)).not.toContain(pref);
    expect(trancheFields('fixed', 'senior_non_preferred').map(r => r.p)).toContain(pref);
  });
});

describe('tranche values', () => {
  const main = { [CCY]: 'USD', [LAW]: 'GB', [MAT]: '2031-01-01' };
  it('currency is copied from Tranche A until changed', () => {
    expect(trancheValue(CCY, false, main, {})).toBe('USD');
    expect(trancheValue(CCY, false, main, { [CCY]: 'EUR' })).toBe('EUR');
  });
  it('governing law is the same for all tranches', () => {
    expect(trancheValue(LAW, false, main, { [LAW]: 'US' })).toBe('GB');
  });
  it('maturity is not copied to other tranches', () => {
    expect(trancheValue(MAT, false, main, {})).toBe('');
    expect(trancheValue(MAT, true, main, {})).toBe('2031-01-01');
  });
});
