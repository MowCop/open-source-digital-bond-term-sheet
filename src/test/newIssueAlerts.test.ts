import { describe, it, expect } from 'vitest';
import { isValidDistributionEmail, parseAddresses, renderBulletin, termsDiff, termsHash, buildSendRequest, selectRecipients, buildSubject } from '@/lib/newIssueAlerts';
import { termsHash as serverHash } from '../../supabase/functions/_shared/alert-terms.ts';
import { P, type BdtState } from '@/lib/bdt-bridge';

const state = (coupon: string): BdtState => ({
  stage: 2, deal: 'ACME', ver: '1', seq: 1,
  f: { [P.currency]: 'EUR', [P.totalAmount]: '500000000', 'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate': coupon },
  contacts: [], parties: [{ PartyName: 'Acme SA', LEIIdentifier: '', Roles: ['ISSUER'], Ratings: [] } as never], ids: [], ratings: [], docs: [], releases: [], suggestions: [], files: [],
});

describe('distribution email validation', () => {
  it('accepts desk addresses and rejects malformed ones', () => {
    expect(isValidDistributionEmail('newissues@vendor.com')).toBe(true);
    expect(isValidDistributionEmail('newissues@vendor')).toBe(false);
    expect(isValidDistributionEmail('not an email')).toBe(false);
    expect(parseAddresses('A@x.com; a@x.com, bad@')).toEqual({ addresses: ['a@x.com'], invalid: ['bad@'] });
  });
});

describe('live bulletin', () => {
  it('re-renders terms after a saved change and keeps user text', () => {
    const before = renderBulletin({ state: state('4.25'), intro: 'My intro', notes: 'My note' });
    const after = renderBulletin({ state: state('4.5'), intro: 'My intro', notes: 'My note' });
    expect(before).not.toBe(after);
    expect(after).toContain('4.5');
    expect(after).toContain('My intro');
    expect(after).toContain('My note');
    expect(termsDiff(state('4.25'), state('4.5')).map(d => d.label)).toEqual(['Coupon']);
  });
  it('appends legal notices verbatim', () => {
    expect(renderBulletin({ state: state('4'), intro: '', notes: '', legalNotices: ['Not for US persons.'] })).toContain('<h3>Legal Notices</h3><p>Not for US persons.</p>');
  });
});

describe('sending', () => {
  const base = { dealId: 'd1', event: 'ipt' as const, subject: 'S', bodyHtml: '<p/>', releaseId: 'r1', state: state('4'), xml: '<x/>' };
  it('refuses without explicit approval', () => {
    expect(() => buildSendRequest({ ...base, approved: false })).toThrow(/approve/);
  });
  it('records the snapshot hash used, matching the server', () => {
    const req = buildSendRequest({ ...base, approved: true });
    expect(req.releaseId).toBe('r1');
    expect(req.bdtHash).toBe(termsHash(state('4')));
    expect(req.bdtHash).toBe(serverHash(state('4')));
    expect(req.bdtHash).not.toBe(termsHash(state('5')));
  });
  it('excludes disabled vendors and vendors without addresses', () => {
    const r = selectRecipients([
      { vendor_id: 'a', vendor_name: 'A', addresses: ['n@a.com'], enabled: true },
      { vendor_id: 'b', vendor_name: 'B', addresses: ['n@b.com'], enabled: false },
      { vendor_id: 'c', vendor_name: 'C', addresses: [], enabled: true },
    ]);
    expect(r.map(x => x.vendorId)).toEqual(['a']);
  });
  it('builds a syndicate-style subject', () => {
    expect(buildSubject(state('4'), 'ipt', 'T+200bp area')).toMatch(/^ACME SA – EUR .* – IPTs T\+200bp area$/);
  });
});
