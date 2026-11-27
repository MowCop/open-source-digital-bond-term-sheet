// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { defaultWorkspaceTab, WORKSPACE_TABS, type DealPhase } from '@/lib/dealPhase';

describe('Default deal view', () => {
  it.each(['setup', 'execution', 'closed'] as DealPhase[])('a %s deal opens on the DTS view', phase => {
    expect(defaultWorkspaceTab(phase)).toBe('dts');
  });

  it('the workspace row offers DTS and Message only — no Co-Pilot tab', () => {
    expect([...WORKSPACE_TABS]).toEqual(['docs', 'dts', 'message']);
  });
});
