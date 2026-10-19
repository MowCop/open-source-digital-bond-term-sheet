import { describe, expect, it } from 'vitest';
import { askText, toLiveChecks } from './liveChecks';

describe('Deal Checker → Co-Pilot hand-off', () => {
  it('asks for an approval-gated fix, naming the check and its source', () => {
    const t = askText({ l: 'fail', t: 'Coupon missing', d: 'Interest rate empty', src: 'bdt' });
    expect(t).toContain('fail');
    expect(t).toContain('"Coupon missing"');
    expect(t).toContain('term-editor approval');
  });
  it('marks only user-ignored warnings as ignored', () => {
    const r = toLiveChecks([{ l: 'warn', t: 'a' }, { l: 'fail', t: 'b' }], () => true);
    expect(r.map(c => c.ignored)).toEqual([true, undefined]);
  });
});
