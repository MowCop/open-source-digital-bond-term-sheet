import { describe, expect, it } from 'vitest';
import { dealBorrowerName, shortBorrowerName } from '@/lib/borrowerName';
import { extractBorrowerName, mergeDealFromText } from '@/lib/alertParsing';
import type { Deal } from '@/types/bond';

describe('shortBorrowerName', () => {
  it('shows the Al Rajhi borrower without the bond description', () => {
    expect(shortBorrowerName('Al Rajhi Bank – Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk')).toBe('Al Rajhi Bank');
  });
  it('preserves hyphens within borrower names', () => {
    expect(shortBorrowerName('Rolls-Royce Holdings')).toBe('Rolls-Royce Holdings');
  });
  it('shows Sasol while preserving the legal issuer in the authoritative terms', () => {
    const deal = { issuerName: 'provides treasury services to the Sasol group and has no other operations.', bdtState: { f: {}, parties: [{ PartyName: 'Sasol Financing USA LLC', Roles: ['ISSUER'] }] } };
    expect(dealBorrowerName(deal)).toBe('Sasol');
    expect(deal.bdtState.parties[0].PartyName).toBe('Sasol Financing USA LLC');
  });
  it('does not restore a deleted authoritative issuer from a stale cache', () => {
    expect(dealBorrowerName({ issuerName: 'Sasol', bdtState: { f: {}, parties: [] } })).toBe('');
  });
  it('extracts the Sasol legal issuer, never its treasury-services description', () => {
    expect(extractBorrowerName('Sasol Financing USA LLC – Mandate Announcement: USD Senior Notes\nThe issuer provides treasury services to the Sasol group and has no other operations.')).toBe('Sasol Financing USA LLC');
  });
  it('ignores narrative issuer text before an explicit name field', () => {
    expect(extractBorrowerName('The issuer provides services to the Sasol group. Issuer: Sasol Financing USA LLC; Currency: USD')).toBe('Sasol Financing USA LLC');
  });
  it('does not rename a recorded borrower when publishing an update', () => {
    const existing = { issuerName: 'Sasol', currency: 'USD', bookrunners: [] } as unknown as Deal;
    expect(mergeDealFromText(existing, 'Issuer: Sasol Financing USA LLC; Currency: USD').patch).not.toHaveProperty('issuerName');
  });
  it('does not fill an intentionally blank authoritative issuer on publication', () => {
    const existing = { issuerName: '', bdtState: { f: {}, parties: [] }, bookrunners: [] } as unknown as Deal;
    expect(mergeDealFromText(existing, 'Issuer: Sasol Financing USA LLC; Currency: USD').patch).not.toHaveProperty('issuerName');
  });
});