import { buildFromHeader, ALERT_FROM_DOMAIN } from './chunk.ts';

export type MailProvider = 'resend' | 'microsoft_graph' | 'gmail';
export interface AlertMessage {
  fromName: string; fromOrg: string; replyTo: string; to: string; bcc: string[];
  subject: string; html: string; attachment: { filename: string; content: string };
  idempotencyKey: string;
}
export type SendResult = { ok: true; id: string } | { ok: false; error: string; code: string };

const GATEWAY = 'https://connector-gateway.lovable.dev/resend';
const b64 = (s: string) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const x of bytes) bin += String.fromCharCode(x); return btoa(bin); };
const gw = () => ({ Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'X-Connection-Api-Key': Deno.env.get('RESEND_API_KEY') ?? '' });

/** Resend refuses unverified senders; check up-front so the user sees a clear reason. */
export async function resendDomainVerified(): Promise<boolean> {
  if (!Deno.env.get('LOVABLE_API_KEY') || !Deno.env.get('RESEND_API_KEY')) return false;
  const res = await fetch(`${GATEWAY}/domains`, { headers: gw() });
  if (!res.ok) return false;
  const body = await res.json().catch(() => ({ data: [] }));
  return (body.data ?? []).some((d: { name: string; status: string }) => d.name === ALERT_FROM_DOMAIN && d.status === 'verified');
}

/** Graph delegated sending needs the deal admin's own Microsoft 365 connection (not set up yet). */
export function graphConnected(_userId: string): boolean { return false; }

async function sendResend(m: AlertMessage): Promise<SendResult> {
  if (!(await resendDomainVerified())) return { ok: false, code: 'domain_not_verified', error: `The sending domain ${ALERT_FROM_DOMAIN} is not verified in Resend yet.` };
  const res = await fetch(`${GATEWAY}/emails`, {
    method: 'POST',
    headers: { ...gw(), 'Content-Type': 'application/json', 'Idempotency-Key': m.idempotencyKey },
    body: JSON.stringify({ from: buildFromHeader(m.fromName, m.fromOrg), to: [m.to], bcc: m.bcc, reply_to: m.replyTo, subject: m.subject, html: m.html, attachments: [{ filename: m.attachment.filename, content: b64(m.attachment.content) }] }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, code: 'provider_error', error: `[${res.status}] ${text.slice(0, 500)}` };
  try { return { ok: true, id: String(JSON.parse(text).id ?? '') }; } catch { return { ok: true, id: '' }; }
}

/** One interface for every mail channel. Never falls back to another provider. */
export async function sendAlertEmail(provider: MailProvider, m: AlertMessage, ctx: { userId: string }): Promise<SendResult> {
  switch (provider) {
    case 'resend': return sendResend(m);
    case 'microsoft_graph':
      if (!graphConnected(ctx.userId)) return { ok: false, code: 'not_connected', error: `Microsoft 365 is not connected for ${m.fromName}. Connect it in Bond Console → Recipients, or choose another provider.` };
      return { ok: false, code: 'not_connected', error: 'Microsoft 365 sending is not available yet.' };
    case 'gmail': return { ok: false, code: 'not_available', error: 'Gmail sending is not available yet.' };
  }
}
