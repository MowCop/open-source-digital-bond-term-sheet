import { describe, expect, it } from 'vitest';
import { dtsLink, parseDtsStage, updateTermSheetStage } from '@/lib/dtsNavigation';
import type { Deal, Message } from '@/types/bond';

const deal = { id: 'bond-1', stage: 'Priced', stageHistory: [] } as unknown as Deal;
const message = (subject: string): Message => ({ id: 'update', subject, body: '', dealIds: [deal.id], createdAt: new Date('2026-09-03T15:40:00Z') } as Message);
describe('DTS update navigation', () => {
  it('opens Priced Fill for a priced update of the same deal', () => {
    expect(dtsLink(message('Issuer – PRICED'), deal)).toBe('/deals?dealId=bond-1&tab=fill&stage=5&at=2026-09-03T15%3A40%3A00.000Z');
  });
  it('keeps an earlier IPT update at IPT even when the deal is now Priced', () => {
    expect(updateTermSheetStage(message('Issuer – IPTs T+200bps area'), deal)).toBe(2);
  });
  it('matches guidance and launch separately', () => {
    expect(updateTermSheetStage(message('Issuer – Guidance'), deal)).toBe(3);
    expect(updateTermSheetStage(message('Issuer – Launched'), deal)).toBe(4);
  });
  it('matches each Al Rajhi reference message to its saved stage', () => {
    for (const [id, stage] of [['1-1', 2], ['2-0', 3], ['3-0', 4], ['4-0', 5]] as const) {
      expect(updateTermSheetStage({ ...message(''), id: `demo-${deal.id}-${id}` }, deal)).toBe(stage);
    }
  });
  it('rejects stage numbers outside the seven term-sheet steps', () => {
    expect(parseDtsStage('5')).toBe(5);
    expect(parseDtsStage('8')).toBeUndefined();
    expect(parseDtsStage(null)).toBeUndefined();
  });
});