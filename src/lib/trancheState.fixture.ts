import type { BdtState } from '@/lib/bdt-bridge';
import type { DealWorkspace } from '@/lib/dealWorkspace';
import { trancheFields } from '@/lib/trancheFields';
const all = [...trancheFields('fixed'), ...trancheFields('floating')];
const own = all.find(r => r.scope === 'own')!.p;
const copied = all.find(r => r.scope === 'copied')!.p;
const deal = all.find(r => r.scope === 'deal')!.p;
const main = { stage: 1, deal: '', ver: '', seq: 0, contacts: [], f: { [own]: 'A-own', [copied]: 'A-copied', [deal]: 'A-deal' } } as unknown as BdtState;
const ws = { version: 1, tranches: [
  { id: 'a', label: 'A', rateType: 'fixed', currency: 'USD', amount: null, values: {} },
  { id: 'b', label: 'B', rateType: 'fixed', currency: 'USD', amount: null, values: { [own]: 'B-own', [deal]: 'ignored' } },
], plannedTotals: {}, fx: {} } as unknown as DealWorkspace;
export const ROWS_FOR_TEST = { main, ws, own, copied, deal };
