import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditBoardUpdate } from '@/lib/boardUpdateAudit';
import type { Attachment } from '@/types/bond';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
const attachment = (name: string): Attachment => ({ id: name, name, url: 'data:application/pdf;base64,', type: 'pdf', size: 10 });
describe('board update content audit', () => {
  beforeEach(() => { invoke.mockReset(); invoke.mockResolvedValue({ data: { findings: [] }, error: null }); });
  it('checks the selected message and document content, not saved deal fields', async () => {
    const result = await auditBoardUpdate('<p>Republic of Italy EUR 10Y</p>', [attachment('Emirates.docx')], undefined, async () => 'Issuer: Emirates');
    const body = invoke.mock.calls[0][1].body;
    expect(body.scope).toBe('board_update');
    expect(body.message).toBe('Republic of Italy EUR 10Y');
    expect(body.fields).toEqual([]);
    expect(body.docs).toEqual([{ name: 'Emirates.docx', text: 'Issuer: Emirates' }]);
    expect(result.read).toEqual(['Emirates.docx']);
  });
  it('reports unreadable attachments without claiming they were checked', async () => {
    const result = await auditBoardUpdate('Update', [attachment('broken.pdf')], undefined, async () => { throw new Error('Unreadable'); });
    expect(result.failed).toEqual(['broken.pdf']);
    expect(result.read).toEqual([]);
    expect(invoke.mock.calls[0][1].body.docs).toEqual([]);
  });
  it('caps a single large document below the server per-document limit', async () => {
    await auditBoardUpdate('Update', [attachment('large.pdf')], undefined, async () => 'a'.repeat(150_000));
    expect(invoke.mock.calls[0][1].body.docs[0].text.length).toBe(100_000);
  });
  it('does not turn invalid AI output into a clean audit', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    await expect(auditBoardUpdate('Update', [])).rejects.toThrow('no valid results');
  });
  it('preserves warnings returned by AI', async () => {
    const finding = { title: 'Issuer mismatch', detail: 'Different issuer in attachment', fieldPath: '', currentValue: 'Italy', docValue: '', docQuote: 'Issuer: Emirates' };
    invoke.mockResolvedValue({ data: { findings: [finding] }, error: null });
    expect((await auditBoardUpdate('Italy', [])).findings).toEqual([finding]);
  });
});