import { describe, it, expect } from 'vitest';
import { validateBdt, validLEI, validISIN, exportBdtToJson } from '@/lib/taxonomy';

const base = { stage: 1, f: { 'IssuanceDataGroup/Issuance/SpecifiedCurrency': 'EUR' }, parties: [{ PartyName: 'Acme' }] };

describe('taxonomy', () => {
  it('identifier checks', () => {
    expect(validLEI('529900T8BM49AURSDO55')).toBe(true);
    expect(validLEI('529900T8BM49AURSDO56')).toBe(false);
    expect(validISIN('US0378331005')).toBe(true);
    expect(validISIN('US0378331006')).toBe(false);
  });
  it('mandate stage valid with currency and issuer', () => {
    expect(validateBdt(base).isValid).toBe(true);
  });
  it('priced stage requires pricing fields', () => {
    const r = validateBdt({ ...base, stage: 6 });
    expect(r.isValid).toBe(false);
    expect(r.stageName).toBe('Priced');
    expect(r.errors.some((e) => e.path === 'IssuanceDataGroup/Issuance/PricingDate')).toBe(true);
  });
  it('flags non-standard settlement cycle', () => {
    const r = validateBdt({ ...base, f: { ...base.f, 'IssuanceDataGroup/Issuance/PricingDate': '2026-03-02', 'IssuanceDataGroup/Issuance/SettlementDate': '2026-03-03' } });
    expect(r.warnings.some((w) => w.code === 'SETTLEMENT_CYCLE')).toBe(true);
  });
  it('json export nests paths', () => {
    const j = JSON.parse(exportBdtToJson(base));
    expect(j.ICMABondDataTaxonomy.IssuanceDataGroup.Issuance.SpecifiedCurrency).toBe('EUR');
  });
});
