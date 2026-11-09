import { describe, it, expect } from 'vitest';
import { chunkRecipients, buildFromHeader, bccList, canSend, providerStatus } from '@/lib/alertMail';
import * as server from '../../supabase/functions/_shared/mail/chunk.ts';
import { senderRecord } from '@/lib/newIssueAlerts';

const addrs = (n: number) => Array.from({ length: n }, (_, i) => `v${i}@vendor${i}.com`);
const TO = 'jane.saunders@bnpparibas.com';

describe('BCC chunking at 50 (To + BCC)', () => {
  it('splits 1 To + 120 BCC into 3 emails of at most 50 addresses', () => {
    const c = chunkRecipients(TO, addrs(120));
    expect(c.length).toBe(3);
    for (const x of c) expect(x.length + 1).toBeLessThanOrEqual(50);
    expect(c.flat().sort()).toEqual(addrs(120).sort());
  });
  it('49 BCC fits in one email; 50 BCC needs two', () => {
    expect(chunkRecipients(TO, addrs(49)).length).toBe(1);
    expect(chunkRecipients(TO, addrs(50)).length).toBe(2);
  });
  it('server and browser chunking agree', () => {
    expect(server.chunkRecipients(TO, addrs(120))).toEqual(chunkRecipients(TO, addrs(120)));
    expect(server.buildFromHeader('Jane Saunders', 'BNP Paribas')).toBe(buildFromHeader('Jane Saunders', 'BNP Paribas'));
  });
});

describe('deal admin identity', () => {
  it('display name and Reply-To use the deal admin', () => {
    expect(buildFromHeader('Jane Saunders', 'BNP Paribas')).toBe('"Jane Saunders (BNP Paribas) via DTS" <newissues@alerts.eurobondmarkets.com>');
    expect(senderRecord({ name: 'Jane Saunders', email: 'Jane.Saunders@BNPParibas.com', organization: 'BNP Paribas' }).reply_to).toBe(TO);
  });
  it('records sender name, email and organisation on the log', () => {
    expect(senderRecord({ name: 'Jane Saunders', email: 'Jane.Saunders@BNPParibas.com', organization: 'BNP Paribas' }))
      .toMatchObject({ sender_name: 'Jane Saunders', sender_email: TO, sender_org: 'BNP Paribas', to_address: TO });
  });
});

describe('syndicate mailbox', () => {
  it('is always in BCC, even with no vendors, and deduped', () => {
    expect(bccList([], 'syndicate@bnp.com')).toEqual(['syndicate@bnp.com']);
    expect(bccList(['Syndicate@bnp.com', 'n@a.com'], 'syndicate@bnp.com')).toEqual(['syndicate@bnp.com', 'n@a.com']);
  });
});

describe('provider selection', () => {
  it('microsoft_graph refuses while not connected, with a clear message', () => {
    const st = providerStatus('microsoft_graph', { resendVerified: true, graphConnected: false });
    expect(st).toBe('not_connected');
    const r = canSend('microsoft_graph', st, 'Jane Saunders');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Microsoft 365 is not connected for Jane Saunders/);
  });
  it('never falls back to resend when graph is selected', () => {
    // Resend being ready does not make Graph sendable.
    expect(canSend('microsoft_graph', providerStatus('microsoft_graph', { resendVerified: true })).ok).toBe(false);
  });
  it('gmail always refuses', () => {
    expect(canSend('gmail', providerStatus('gmail')).ok).toBe(false);
  });
});
