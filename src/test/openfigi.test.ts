import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { validFIGI, figiChecks } from '@/lib/openfigi';

const st = (ids: Array<{ Type: string; Value: string }>, stage = 3) => ({ ids, stage, parties: [], f: {} }) as never;

describe('validFIGI', () => {
  it('accepts real FIGIs', () => {
    expect(validFIGI('BBG01BGVXMB1')).toBe(true);
    expect(validFIGI('BBG000BLNNH6')).toBe(true);
  });
  it('rejects a wrong check digit', () => expect(validFIGI('BBG000BLNNH7')).toBe(false));
  it('rejects vowels and bad prefixes', () => {
    expect(validFIGI('BBG000BLANH6')).toBe(false);
    expect(validFIGI('GBG000BLNNH6')).toBe(false);
  });
});

describe('figiChecks', () => {
  it('passes when FIGI matches ISIN', () => {
    const c = figiChecks(st([{ Type: 'ISIN', Value: 'US912810TM09' }, { Type: 'FIGI', Value: 'BBG01BGVXMB1' }]), { found: true, figi: 'BBG01BGVXMB1' });
    expect(c.find(x => x.t === 'FIGI matches ISIN on OpenFIGI')?.l).toBe('pass');
  });
  it('warns on mismatch', () => {
    const c = figiChecks(st([{ Type: 'ISIN', Value: 'US912810TM09' }, { Type: 'FIGI', Value: 'BBG000BLNNH6' }]), { found: true, figi: 'BBG01BGVXMB1' });
    expect(c.find(x => x.t === 'FIGI does not match ISIN on OpenFIGI')?.l).toBe('warn');
  });
  it('not found is a pass before pricing and a warning after', () => {
    expect(figiChecks(st([{ Type: 'ISIN', Value: 'XS0000000009' }], 3), { found: false })[0].l).toBe('pass');
    expect(figiChecks(st([{ Type: 'ISIN', Value: 'XS0000000009' }], 5), { found: false })[0].l).toBe('warn');
  });
  it('warns when the service is unreachable', () => {
    expect(figiChecks(st([{ Type: 'ISIN', Value: 'XS0000000009' }]), { found: false, error: 'down' })[0].l).toBe('warn');
  });
});
