import { describe, it, expect } from 'vitest';
import { scopeDeals } from '@/lib/scoping';
const deals = [{ id: 'a', createdByOrg: 'Other Bank', bookrunners: [] }, { id: 'alrajhi', createdByOrg: 'X', bookrunners: [] }] as never[];
describe('deal scoping', () => {
  it('Dana M sees every deal', () => {
    expect(scopeDeals(deals, { isMaster: false, isSyndicateAdmin: true, currentOrg: 'Marz Products', currentEmail: 'Dana.Marzouq@hotmail.com' })).toHaveLength(2);
  });
  it('other syndicate admins stay limited to their organisation', () => {
    expect(scopeDeals(deals, { isMaster: false, isSyndicateAdmin: true, currentOrg: 'Marz Products', currentEmail: 'someone@else.com' })).toHaveLength(0);
  });
});
