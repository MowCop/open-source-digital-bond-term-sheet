import { assertEquals } from 'jsr:@std/assert@1';
import { checkerFindings } from './remediation.ts';

const live = [
  { l: 'pass' as const, t: 'ISIN valid' },
  { l: 'fail' as const, t: 'Coupon missing' },
  { l: 'warn' as const, t: 'Benchmark missing', ignored: true },
  { l: 'warn' as const, t: 'Tenor unclear' },
];

Deno.test('ignored warnings and passes are excluded', () => {
  assertEquals(checkerFindings([], live).map((f) => f.check), ['Coupon missing', 'Tenor unclear']);
});

Deno.test('proposal requires a surviving evidenced term', () => {
  const ai = [{ check: 'Coupon missing', resolution: 'proposed', field: 'coupon' }];
  assertEquals(checkerFindings(ai, live, [])[0].resolution, 'needs_input');
  assertEquals(checkerFindings(ai, live, [{ field: 'coupon' }])[0].resolution, 'proposed');
});
