/** Browser mirror of supabase/functions/_shared/mail/chunk.ts plus provider status rules. */
export const MAX_RECIPIENTS = 50;
export const ALERT_FROM_ADDRESS = 'newissues@alerts.eurobondmarkets.com';
export const ALERT_FROM_DOMAIN = 'alerts.eurobondmarkets.com';

/** Splits BCC into emails of at most `max` addresses each, counting the To address in every email. */
export function chunkRecipients(to: string, bcc: string[], max = MAX_RECIPIENTS): string[][] {
  const t = to.trim().toLowerCase();
  const seen = new Set<string>([t]);
  const list: string[] = [];
  for (const a of bcc) { const x = a.trim().toLowerCase(); if (x && !seen.has(x)) { seen.add(x); list.push(x); } }
  const per = max - 1;
  if (!list.length) return [[]];
  const out: string[][] = [];
  for (let i = 0; i < list.length; i += per) out.push(list.slice(i, i + per));
  return out;
}

export function buildFromHeader(name: string, org: string) {
  const clean = (s: string) => s.replace(/["<>\r\n]/g, '').trim();
  const n = clean(name) || 'Deal admin';
  const o = clean(org);
  return `"${n}${o ? ` (${o})` : ''} via DTS" <${ALERT_FROM_ADDRESS}>`;
}

export type MailProvider = 'resend' | 'microsoft_graph' | 'gmail';
export type ProviderStatus = 'ready' | 'domain_not_verified' | 'not_connected' | 'not_available';

export const PROVIDERS: { id: MailProvider; label: string }[] = [
  { id: 'resend', label: 'Resend (DTS sender)' },
  { id: 'microsoft_graph', label: 'Microsoft 365 (send as deal admin)' },
  { id: 'gmail', label: 'Gmail (coming later)' },
];

export const STATUS_LABEL: Record<ProviderStatus, string> = {
  ready: 'Ready', domain_not_verified: 'Domain not verified', not_connected: 'Not connected', not_available: 'Not available',
};

export function providerStatus(provider: MailProvider, opts: { resendVerified?: boolean; graphConnected?: boolean } = {}): ProviderStatus {
  if (provider === 'resend') return opts.resendVerified === false ? 'domain_not_verified' : 'ready';
  if (provider === 'microsoft_graph') return opts.graphConnected ? 'ready' : 'not_connected';
  return 'not_available';
}

/** Whether the selected provider may send. Never substitutes another provider. */
export function canSend(provider: MailProvider, status: ProviderStatus, adminName = 'the deal admin'): { ok: boolean; message?: string } {
  if (status === 'ready') return { ok: true };
  if (provider === 'microsoft_graph') return { ok: false, message: `Microsoft 365 is not connected for ${adminName}. Connect it in Bond Console → Recipients, or choose another provider.` };
  if (provider === 'gmail') return { ok: false, message: 'Gmail sending is not available yet.' };
  return { ok: false, message: 'The sending domain alerts.eurobondmarkets.com is not verified in Resend yet.' };
}

/** All BCC addresses for a send: enabled vendor addresses plus the always-included syndicate mailbox. */
export function bccList(vendorAddresses: string[], syndicateMailbox: string): string[] {
  const out: string[] = []; const seen = new Set<string>();
  for (const a of [...vendorAddresses, syndicateMailbox]) { const x = a.trim().toLowerCase(); if (x && !seen.has(x)) { seen.add(x); out.push(x); } }
  return out;
}
