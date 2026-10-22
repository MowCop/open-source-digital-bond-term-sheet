import { describe, expect, it } from 'vitest';
import { checkCalendar, readLiveChecks, searchReferenceLibrary } from '../../../supabase/functions/deal-copilot/knowledge/tools.ts';

describe('Co-Pilot Deal Checker resources', () => {
  it('flags Easter Monday 2026 as a TARGET2 holiday and rolls Modified Following', () => {
    const r = checkCalendar({ date: '2026-04-06', currency: 'EUR' });
    expect(r.businessDay).toBe(false);
    expect(r.holidayIn).toEqual(['TARGET2']);
    expect(r.modifiedFollowing).toBe('2026-04-07');
  });
  it('computes T+2 across the US Independence Day observance', () => {
    expect(checkCalendar({ date: '2026-07-02', calendars: ['US'], settlementLag: 2 }).settlementDate).toBe('2026-07-07');
  });
  it('warns when dates fall outside 2024–2027 coverage', () => {
    expect(String(checkCalendar({ date: '2028-03-01', currency: 'GBP' }).coverage)).toMatch(/Outside/);
  });
  it('finds ICMA Appendix A8 passages', () => {
    const r = searchReferenceLibrary({ query: 'TEFRA', sourceId: 'icma-a8' });
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results[0].source).toContain('Appendix-A8');
  });
  it('finds ICMA Appendix C1 BDT passages', () => {
    const r = searchReferenceLibrary({ query: 'legal documentation will prevail', sourceId: 'icma-c1' });
    expect(r.results[0].source).toContain('AppendixC1');
  });
  it('finds ICMA DLT FAQ passages', () => {
    const r = searchReferenceLibrary({ query: 'blockchain', sourceId: 'icma-dlt-faq' });
    expect(r.results[0].source).toContain('DLT-and-blockchain');
  });
  it('excludes user-ignored warnings from the live tally', () => {
    const r = readLiveChecks([{ l: 'warn', t: 'a', ignored: true }, { l: 'fail', t: 'b' }]) as any;
    expect(r.tally).toEqual({ pass: 0, warn: 0, fail: 1, ignored: 1 });
  });
});
