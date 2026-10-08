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
