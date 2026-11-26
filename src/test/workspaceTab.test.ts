// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { defaultWorkspaceTab, type DealPhase } from '@/lib/dealPhase';

describe('Default deal view', () => {
  it.each(['setup', 'execution', 'closed'] as DealPhase[])('a %s deal opens on the DTS view', phase => {
    expect(defaultWorkspaceTab(phase)).toBe('dts');
  });
});
