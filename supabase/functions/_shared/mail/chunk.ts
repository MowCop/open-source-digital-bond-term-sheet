/** Mirror of src/lib/alertMail.ts chunking/header rules (kept consistent by tests). */
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
