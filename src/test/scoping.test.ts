import { describe, it, expect } from 'vitest';
import { scopeDeals, emailHash, hasAllDealsAccess, ALL_DEALS_ACCESS_HASHES } from '@/lib/scoping';
const deals = [{ id: 'a', createdByOrg: 'Other Bank', bookrunners: [] }, { id: 'demo', createdByOrg: 'X', bookrunners: [] }] as never[];
describe('deal scoping', () => {
  it('a hashed allowlist entry grants every deal, ignoring case and spaces', () => {
    const allowlist = [emailHash('pat.example@example.com')];
    expect(hasAllDealsAccess(' Pat.Example@EXAMPLE.com ', allowlist)).toBe(true);
    expect(hasAllDealsAccess('someone@else.com', allowlist)).toBe(false);
    expect(hasAllDealsAccess(null, allowlist)).toBe(false);
  });
  it('the allowlist holds hashes, not email addresses', () => {
    expect(ALL_DEALS_ACCESS_HASHES.every(h => !h.includes('@'))).toBe(true);
  });
  it('other syndicate admins stay limited to their organisation', () => {
    expect(scopeDeals(deals, { isMaster: false, isSyndicateAdmin: true, currentOrg: 'Marz Products', currentEmail: 'someone@else.com' })).toHaveLength(0);
  });
});
