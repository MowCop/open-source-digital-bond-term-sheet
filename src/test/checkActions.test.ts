import { describe, expect, it } from 'vitest';
import type { BdtState } from '@/lib/bdt-bridge';
import { checkFix, checkTarget } from '@/lib/checkActions';

describe('Deal Checker actions', () => {
  it('derives the common code from an XS ISIN', () => {
    const s = { f: {}, ids: [{ Type: 'ISIN', Value: 'XS1234567890' }] } as unknown as BdtState;
    const fix = checkFix({ l: 'warn', t: 'No common code' }, s);
    expect(fix?.apply(s).ids).toContainEqual({ Type: 'COMMON_CODE', Value: '123456789' });
  });
  it('offers no common-code fix for non-XS ISINs', () => {
    expect(checkFix({ l: 'warn', t: 'No common code' }, { f: {}, ids: [{ Type: 'ISIN', Value: 'US0378331005' }] } as unknown as BdtState)).toBeNull();
  });
  it('adds a FIGI reported by OpenFIGI', () => {
    const s = { f: {}, ids: [] } as unknown as BdtState;
    const fix = checkFix({ l: 'warn', t: 'FIGI available but not recorded', d: 'OpenFIGI maps X to BBG000B9XRY4. Add it.' }, s);
    expect(fix?.apply(s).ids).toEqual([{ Type: 'FIGI', Value: 'BBG000B9XRY4' }]);
  });
  it('points LEI warnings at the party list', () => {
    expect(checkTarget({ l: 'warn', t: '3 parties without an LEI' })).toMatchObject({ kind: 'group', g: 'parties' });
  });
});

import { docTopics, proposalMatches } from '@/lib/checkActions';
describe('Try to fix from the dropped document', () => {
  it('reads currency, tenor, benchmark and bookrunner gaps from a required-fields fail', () => {
    expect(docTopics({ l: 'fail', t: '5 required fields are empty', d: 'Specified currency; Maturity date; Benchmark security' }))
      .toEqual(['currency', 'tenor', 'benchmark']);
    expect(docTopics({ l: 'warn', t: '3 managers named' })).toContain('bookrunner');
  });
  it('matches proposals only to their own topic', () => {
    expect(proposalMatches('currency', { kind: 'field', p: 'IssuanceDataGroup/Issuance/SpecifiedCurrency' })).toBe(true);
    expect(proposalMatches('tenor', { kind: 'field', p: 'IssuanceDataGroup/Issuance/Benchmark/Maturity/MaturityDate' })).toBe(false);
    expect(proposalMatches('benchmark', { kind: 'field', p: 'IssuanceDataGroup/Issuance/Benchmark/Ticker/Ticker' })).toBe(true);
    expect(proposalMatches('bookrunner', { kind: 'group', g: 'parties' })).toBe(true);
  });
});
