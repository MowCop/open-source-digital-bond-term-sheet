import { describe, expect, it } from 'vitest';
import { STAGE_LABELS, bdtStageForDeal, bdtStageLabel, stageLabel } from '@/lib/bdt-bridge';
import { STAGES } from '@/lib/termsheet/index.js';

describe('term sheet stage labels', () => {
  it('calls the final stage Settled in the app', () => {
    expect(stageLabel(7)).toBe('Settled');
    expect(bdtStageLabel(7)).toBe('Settled');
    expect(STAGE_LABELS[6]).toBe('Settled');
  });

  it('leaves the other stage names as the dictionary has them', () => {
    expect(stageLabel(1)).toBe('Announcement');
    expect(stageLabel(2)).toBe('Initial price thoughts');
    expect(stageLabel(5)).toBe('Priced');
    expect(stageLabel(6)).toBe('Allocated');
  });

  it('keeps the vendored ICMA wording untouched', () => {
    expect(STAGES[6]).toEqual({ k: 'FINAL', t: 'Final terms' });
  });

  it('maps a Settled deal onto the final term sheet stage', () => {
    expect(bdtStageForDeal('Settled')).toBe(7);
  });
});
