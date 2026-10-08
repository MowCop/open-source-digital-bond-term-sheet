import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { gleifCheck, namesMatch } from '@/lib/gleif';

const LEI = '5493001KJTIIGC8Y1R12';

describe('GLEIF live check', () => {
  it('fails when the LEI is not registered', () => {
    expect(gleifCheck('Acme', LEI, { found: false })?.l).toBe('fail');
  });
  it('fails when the entity is not ACTIVE', () => {
    expect(gleifCheck('Acme', LEI, { found: true, entityStatus: 'INACTIVE', legalName: 'Acme' })?.l).toBe('fail');
  });
  it('warns when the registration has lapsed', () => {
    expect(gleifCheck('Acme', LEI, { found: true, entityStatus: 'ACTIVE', registrationStatus: 'LAPSED', legalName: 'Acme' })?.l).toBe('warn');
  });
  it('warns when the registered name differs from the entered issuer', () => {
    expect(gleifCheck('Kingdom of Spain', LEI, { found: true, entityStatus: 'ACTIVE', registrationStatus: 'ISSUED', legalName: 'Bloomberg Finance L.P.' })?.l).toBe('warn');
  });
  it('passes an active, issued LEI with matching name', () => {
    expect(gleifCheck('Bloomberg Finance LP', LEI, { found: true, entityStatus: 'ACTIVE', registrationStatus: 'ISSUED', legalName: 'Bloomberg Finance L.P.' })?.l).toBe('pass');
  });
  it('warns, not fails, when GLEIF is unreachable', () => {
    expect(gleifCheck('Acme', LEI, { found: false, error: 'timeout' })?.l).toBe('warn');
  });
  it('ignores legal-form suffixes when matching names', () => {
    expect(namesMatch('Volkswagen AG', 'VOLKSWAGEN AKTIENGESELLSCHAFT')).toBe(true);
  });
});

import { rankCandidates, missingLeiCheck } from '@/lib/gleif';
describe('LEI suggestions', () => {
  const c = (legalName: string, entityStatus = 'ACTIVE', registrationStatus = 'ISSUED') =>
    ({ lei: legalName.padEnd(20, 'X').slice(0, 20), legalName, country: 'US', entityStatus, registrationStatus });
  it('ranks active above inactive', () => {
    const r = rankCandidates('Acme', [c('Acme Holdings', 'INACTIVE'), c('Acme Holdings Two')]);
    expect(r[0].entityStatus).toBe('ACTIVE');
  });
  it('flags a single active name match as best', () => {
    const r = rankCandidates('Bloomberg Finance', [c('Bloomberg Finance L.P.'), c('Other Co')]);
    expect(r.find(x => x.best)?.legalName).toBe('Bloomberg Finance L.P.');
  });
  it('no best match when two active names match', () => {
    const r = rankCandidates('Bloomberg', [c('Bloomberg L.P.'), c('Bloomberg Finance L.P.')]);
    expect(r.some(x => x.best)).toBe(false);
  });
  it('caps at 5', () => {
    expect(rankCandidates('A', Array.from({ length: 8 }, (_, i) => c(`A${i}`))).length).toBe(5);
  });
  it('warns on a named party with no LEI and matches', () => {
    expect(missingLeiCheck('Bloomberg', 3)?.l).toBe('warn');
    expect(missingLeiCheck('Bloomberg', 0)).toBeNull();
  });
});
