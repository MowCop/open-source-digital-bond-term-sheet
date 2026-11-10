import { describe, it, expect } from 'vitest';
import { trancheBdtState } from './trancheState';
import { ROWS_FOR_TEST } from './trancheState.fixture';
describe('trancheBdtState', () => {
  const { main, ws, own, copied, deal } = ROWS_FOR_TEST;
  it('Tranche A returns the main state', () => { expect(trancheBdtState(main, ws, 0)).toBe(main); });
  it('Tranche B uses its own values, inherits copied, keeps deal-wide', () => {
    const s = trancheBdtState(main, ws, 1);
    expect(s.f[own]).toBe('B-own');
    expect(s.f[copied]).toBe('A-copied');
    expect(s.f[deal]).toBe('A-deal');
  });
  it('Tranche B does not inherit Tranche A own-only values', () => {
    const s = trancheBdtState(main, { ...ws, tranches: [ws.tranches[0], { ...ws.tranches[1], values: {} }] }, 1);
    expect(s.f[own]).toBeUndefined();
  });
});
