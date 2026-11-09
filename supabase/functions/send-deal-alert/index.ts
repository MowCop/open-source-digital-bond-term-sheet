import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { termsHash } from '../_shared/alert-terms.ts';

/**
 * send-deal-alert — emails a human-approved new-issue alert to the caller's
 * organisation's enabled vendor distribution addresses (loaded server-side),
 * attaching the BDT XML of the saved snapshot, and logs per-recipient status.
 * Channels: email only today; Bloomberg MSG / DirectBooks / Symphony would add
 * rows with another `channel` value in alert_send_recipients.
 */
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const FROM = 'Digital Deal Room New Issues <newissues@eurobondmarkets.com>';
const EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const Send = z.object({
  action: z.literal('send'), approved: z.literal(true),
  dealId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  event: z.enum(['mandate', 'ipt', 'guidance', 'books', 'launch', 'pricing', 'final']),
  subject: z.string().trim().min(1).max(300), bodyHtml: z.string().min(1).max(200000),
  releaseId: z.string().uuid(), bdtHash: z.string().max(64), xml: z.string().max(500000),
  bcc: z.string().regex(EMAIL).max(254).optional(),
});
const Retry = z.object({ action: z.literal('retry'), approved: z.literal(true), recipientId: z.string().uuid() });
const Input = z.discriminatedUnion('action', [Send, Retry]);

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const b64 = (s: string) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const x of bytes) bin += String.fromCharCode(x); return btoa(bin); };

async function deliver(to: string, subject: string, html: string, xml: string, filename: string, key: string) {
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'X-Connection-Api-Key': Deno.env.get('RESEND_API_KEY') ?? '', 'Idempotency-Key': key },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, attachments: [{ filename, content: b64(xml) }] }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, error: `[${res.status}] ${text.slice(0, 500)}` };
  try { return { ok: true as const, id: String(JSON.parse(text).id ?? '') }; } catch { return { ok: true as const, id: '' }; }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!Deno.env.get('LOVABLE_API_KEY') || !Deno.env.get('RESEND_API_KEY')) return json({ error: 'Email sending is not configured' }, 500);
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await user.auth.getClaims(auth.slice(7));
    const uid = claims?.claims?.sub as string | undefined;
    if (!uid) return json({ error: 'unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isAdmin } = await user.rpc('is_admin', { _user_id: uid });
    if (!isAdmin) return json({ error: 'Only syndicate admins can send alerts' }, 403);

    let body: unknown; try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const parsed = Input.safeParse(body);
    if (!parsed.success) return json({ error: 'invalid_input', details: parsed.error.flatten() }, 400);
    const p = parsed.data;

    if (p.action === 'retry') {
      const { data: r } = await admin.from('alert_send_recipients').select('*, alert_sends(*)').eq('id', p.recipientId).maybeSingle();
      if (!r || r.status !== 'failed') return json({ error: 'Only failed deliveries can be retried' }, 400);
      const s = r.alert_sends as Record<string, any>;
      const { data: access } = await user.rpc('can_access_deal', { _deal_id: s.deal_id });
      if (!access) return json({ error: 'forbidden' }, 403);
      const { data: rel } = await admin.from('deal_term_sheet_releases').select('bdt_xml').eq('id', s.release_id).maybeSingle();
      const out = await deliver(r.address, s.subject, s.body_html, rel?.bdt_xml ?? '', `${s.deal_id}-v${s.release_version}.xml`, `${r.id}-${r.attempts + 1}`);
      await admin.from('alert_send_recipients').update({ status: out.ok ? 'sent' : 'failed', provider_message_id: out.ok ? out.id : null, error: out.ok ? null : out.error, attempts: r.attempts + 1, updated_at: new Date().toISOString() }).eq('id', r.id);
      await admin.from('audit_log').insert({ id: crypto.randomUUID(), action: 'alert_retry', entity_type: 'deal', entity_id: s.deal_id, user_id: uid, timestamp: new Date().toISOString(), details: JSON.stringify({ sendId: s.id, address: r.address, ok: out.ok }) });
      return json({ ok: out.ok, error: out.ok ? undefined : out.error });
    }

    const { data: access } = await user.rpc('can_access_deal', { _deal_id: p.dealId });
    if (!access) return json({ error: 'forbidden' }, 403);
    const { data: deal } = await admin.from('deals').select('id,stage,bdt_state').eq('id', p.dealId).maybeSingle();
    if (!deal?.bdt_state) return json({ error: 'Save the term sheet before sending' }, 400);
    const current = termsHash(deal.bdt_state);
    if (current !== p.bdtHash) return json({ error: 'Terms changed since preview. Reopen the preview and approve again.' }, 409);
    const { data: rel } = await admin.from('deal_term_sheet_releases').select('id,version,deal_id,bdt_state_snapshot').eq('id', p.releaseId).maybeSingle();
    if (!rel || rel.deal_id !== p.dealId || termsHash(rel.bdt_state_snapshot) !== current) return json({ error: 'Snapshot does not match the saved terms' }, 409);
    await admin.from('deal_term_sheet_releases').update({ bdt_xml: p.xml }).eq('id', rel.id).is('bdt_xml', null);

    const { data: profile } = await admin.from('profiles').select('organization,name,email').eq('user_id', uid).maybeSingle();
    const org = profile?.organization ?? '';
    const { data: dist } = await admin.from('vendor_distribution').select('vendor_id,vendor_name,addresses,enabled').eq('org', org).eq('enabled', true);
    const recipients = (dist ?? []).flatMap(d => [...new Set((d.addresses ?? []).map((a: string) => a.trim().toLowerCase()).filter((a: string) => EMAIL.test(a)))].map(address => ({ vendor_id: d.vendor_id, vendor_name: d.vendor_name, address })));
    if (p.bcc) recipients.push({ vendor_id: '__bcc', vendor_name: 'Syndicate mailbox (BCC)', address: p.bcc.toLowerCase() });
    if (!recipients.length) return json({ error: 'No enabled vendor has a distribution address' }, 400);

    const { data: send, error: sendErr } = await admin.from('alert_sends').insert({
      deal_id: p.dealId, org, event: p.event, stage: deal.stage, subject: p.subject, body_html: p.bodyHtml,
      release_id: rel.id, release_version: rel.version, bdt_hash: current, terms_snapshot: rel.bdt_state_snapshot,
      sender_id: uid, sender_name: profile?.name || profile?.email || '', bcc: p.bcc ?? null, approved_at: new Date().toISOString(),
    }).select('id').single();
    if (sendErr) throw sendErr;
    const { data: rows, error: rowErr } = await admin.from('alert_send_recipients').insert(recipients.map(r => ({ ...r, send_id: send.id }))).select('id,address');
    if (rowErr) throw rowErr;

    const results = [];
    for (const r of rows ?? []) {
      const out = await deliver(r.address, p.subject, p.bodyHtml, p.xml, `${p.dealId}-v${rel.version}.xml`, `${r.id}-1`);
      await admin.from('alert_send_recipients').update({ status: out.ok ? 'sent' : 'failed', provider_message_id: out.ok ? out.id : null, error: out.ok ? null : out.error, attempts: 1, updated_at: new Date().toISOString() }).eq('id', r.id);
      results.push({ address: r.address, ok: out.ok, error: out.ok ? undefined : out.error });
    }
    await admin.from('audit_log').insert({ id: crypto.randomUUID(), action: 'alert_sent', entity_type: 'deal', entity_id: p.dealId, user_id: uid, timestamp: new Date().toISOString(), details: JSON.stringify({ sendId: send.id, event: p.event, releaseVersion: rel.version, bdtHash: current, recipients: results.map(r => ({ address: r.address, ok: r.ok })) }) });
    return json({ sendId: send.id, results });
  } catch (e) {
    console.error('send-deal-alert failed', e);
    return json({ error: e instanceof Error ? e.message : 'Send failed' }, 500);
  }
});
