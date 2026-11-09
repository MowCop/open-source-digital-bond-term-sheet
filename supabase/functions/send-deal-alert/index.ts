import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { termsHash } from '../_shared/alert-terms.ts';
import { chunkRecipients } from '../_shared/mail/chunk.ts';
import { sendAlertEmail, resendDomainVerified, graphConnected, type MailProvider } from '../_shared/mail/index.ts';

/**
 * send-deal-alert — one human-approved new-issue email per chunk (≤50 addresses
 * incl. To). To = deal admin (the caller, a syndicate admin of the lead
 * bookrunner org); BCC = enabled vendor addresses + the org's syndicate mailbox.
 * Provider is chosen per organisation (org_alert_settings) and never falls back.
 * Later channels (Bloomberg MSG, DirectBooks, Symphony) plug in beside sendAlertEmail.
 */
const EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const Send = z.object({
  action: z.literal('send'), approved: z.literal(true),
  dealId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  event: z.enum(['mandate', 'ipt', 'guidance', 'books', 'launch', 'pricing', 'final']),
  subject: z.string().trim().min(1).max(300), bodyHtml: z.string().min(1).max(200000),
  releaseId: z.string().uuid(), bdtHash: z.string().max(64), xml: z.string().max(500000),
});
const Retry = z.object({ action: z.literal('retry'), approved: z.literal(true), chunkId: z.string().uuid() });
const Status = z.object({ action: z.literal('status') });
const Input = z.discriminatedUnion('action', [Send, Retry, Status]);

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
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

    const { data: profile } = await admin.from('profiles').select('organization,name,email').eq('user_id', uid).maybeSingle();
    const org = profile?.organization ?? '';
    const sender = { name: profile?.name || profile?.email || '', email: (profile?.email ?? '').toLowerCase(), org };
    const { data: settings } = await admin.from('org_alert_settings').select('provider,syndicate_mailbox').eq('org', org).maybeSingle();
    const provider = (settings?.provider ?? 'resend') as MailProvider;
    const mailbox = settings?.syndicate_mailbox?.toLowerCase() ?? '';

    if (p.action === 'status') {
      return json({ provider, syndicateMailbox: mailbox, resendVerified: await resendDomainVerified(), graphConnected: graphConnected(uid), sender });
    }

    if (p.action === 'retry') {
      const { data: c } = await admin.from('alert_send_chunks').select('*, alert_sends(*)').eq('id', p.chunkId).maybeSingle();
      if (!c || c.status !== 'failed') return json({ error: 'Only failed emails can be retried' }, 400);
      const s = c.alert_sends as Record<string, any>;
      const { data: access } = await user.rpc('can_access_deal', { _deal_id: s.deal_id });
      if (!access) return json({ error: 'forbidden' }, 403);
      if (s.sender_id !== uid) return json({ error: 'Only the deal admin who sent this alert can retry it' }, 403);
      const { data: rel } = await admin.from('deal_term_sheet_releases').select('bdt_xml').eq('id', s.release_id).maybeSingle();
      const out = await sendAlertEmail(s.provider as MailProvider, {
        fromName: s.sender_name, fromOrg: s.sender_org ?? '', replyTo: s.reply_to ?? c.to_address, to: c.to_address, bcc: c.bcc_addresses,
        subject: s.subject, html: s.body_html, attachment: { filename: `${s.deal_id}-v${s.release_version}.xml`, content: rel?.bdt_xml ?? '' },
        idempotencyKey: `${c.id}-${c.attempts + 1}`,
      }, { userId: uid });
      await admin.from('alert_send_chunks').update({ status: out.ok ? 'sent' : 'failed', provider_message_id: out.ok ? out.id : null, error: out.ok ? null : out.error, attempts: c.attempts + 1, updated_at: new Date().toISOString() }).eq('id', c.id);
      await admin.from('audit_log').insert({ id: crypto.randomUUID(), action: 'alert_retry', entity_type: 'deal', entity_id: s.deal_id, user_id: uid, timestamp: new Date().toISOString(), details: JSON.stringify({ sendId: s.id, chunk: c.chunk_index, ok: out.ok }) });
      return json({ ok: out.ok, error: out.ok ? undefined : out.error });
    }

    const { data: access } = await user.rpc('can_access_deal', { _deal_id: p.dealId });
    if (!access) return json({ error: 'forbidden' }, 403);
    const { data: deal } = await admin.from('deals').select('id,stage,bdt_state,created_by_org').eq('id', p.dealId).maybeSingle();
    if (!deal?.bdt_state) return json({ error: 'Save the term sheet before sending' }, 400);
    const { data: isMaster } = await user.rpc('has_role', { _user_id: uid, _role: 'master_admin' });
    if (deal.created_by_org && deal.created_by_org !== org && !isMaster) return json({ error: "Only the lead bookrunner's deal admin can send alerts for this deal" }, 403);
    if (!EMAIL.test(sender.email)) return json({ error: 'Your profile has no valid email address to send from' }, 400);
    if (!mailbox || !EMAIL.test(mailbox)) return json({ error: 'Set your organisation’s syndicate mailbox in Bond Console → Recipients before sending.' }, 400);

    const current = termsHash(deal.bdt_state);
    if (current !== p.bdtHash) return json({ error: 'Terms changed since preview. Reopen the preview and approve again.' }, 409);
    const { data: rel } = await admin.from('deal_term_sheet_releases').select('id,version,deal_id,bdt_state_snapshot').eq('id', p.releaseId).maybeSingle();
    if (!rel || rel.deal_id !== p.dealId || termsHash(rel.bdt_state_snapshot) !== current) return json({ error: 'Snapshot does not match the saved terms' }, 409);
    await admin.from('deal_term_sheet_releases').update({ bdt_xml: p.xml }).eq('id', rel.id).is('bdt_xml', null);

    // Refuse before logging if the provider cannot send — no silent fallback.
    if (provider === 'microsoft_graph' && !graphConnected(uid)) return json({ error: `Microsoft 365 is not connected for ${sender.name}. Connect it in Bond Console → Recipients, or choose another provider.` }, 400);
    if (provider === 'gmail') return json({ error: 'Gmail sending is not available yet.' }, 400);
    if (provider === 'resend' && !(await resendDomainVerified())) return json({ error: 'The sending domain alerts.eurobondmarkets.com is not verified in Resend yet.' }, 400);

    const { data: dist } = await admin.from('vendor_distribution').select('vendor_id,addresses').eq('org', org).eq('enabled', true);
    const vendorOf = new Map<string, string>();
    for (const d of dist ?? []) for (const a of d.addresses ?? []) { const x = String(a).trim().toLowerCase(); if (EMAIL.test(x) && !vendorOf.has(x)) vendorOf.set(x, d.vendor_id); }
    const chunks = chunkRecipients(sender.email, [...vendorOf.keys(), mailbox]);

    const { data: send, error: sendErr } = await admin.from('alert_sends').insert({
      deal_id: p.dealId, org, event: p.event, stage: deal.stage, subject: p.subject, body_html: p.bodyHtml,
      release_id: rel.id, release_version: rel.version, bdt_hash: current, terms_snapshot: rel.bdt_state_snapshot,
      sender_id: uid, sender_name: sender.name, sender_email: sender.email, sender_org: org, provider, reply_to: sender.email, to_address: sender.email,
      approved_at: new Date().toISOString(),
    }).select('id').single();
    if (sendErr) throw sendErr;
    const { data: rows, error: rowErr } = await admin.from('alert_send_chunks').insert(chunks.map((bcc, i) => ({
      send_id: send.id, chunk_index: i, to_address: sender.email, bcc_addresses: bcc,
      vendor_ids: [...new Set(bcc.map(a => vendorOf.get(a) ?? '__syndicate'))],
    }))).select('id,chunk_index,bcc_addresses').order('chunk_index');
    if (rowErr) throw rowErr;

    const results = [];
    for (const c of rows ?? []) {
      const out = await sendAlertEmail(provider, {
        fromName: sender.name, fromOrg: org, replyTo: sender.email, to: sender.email, bcc: c.bcc_addresses,
        subject: p.subject, html: p.bodyHtml, attachment: { filename: `${p.dealId}-v${rel.version}.xml`, content: p.xml }, idempotencyKey: `${c.id}-1`,
      }, { userId: uid });
      await admin.from('alert_send_chunks').update({ status: out.ok ? 'sent' : 'failed', provider_message_id: out.ok ? out.id : null, error: out.ok ? null : out.error, attempts: 1, updated_at: new Date().toISOString() }).eq('id', c.id);
      results.push({ chunk: c.chunk_index, recipients: c.bcc_addresses.length + 1, ok: out.ok, error: out.ok ? undefined : out.error });
    }
    await admin.from('audit_log').insert({ id: crypto.randomUUID(), action: 'alert_sent', entity_type: 'deal', entity_id: p.dealId, user_id: uid, timestamp: new Date().toISOString(), details: JSON.stringify({ sendId: send.id, event: p.event, provider, sender, releaseVersion: rel.version, bdtHash: current, chunks: results.map(r => ({ chunk: r.chunk, ok: r.ok })) }) });
    return json({ sendId: send.id, results });
  } catch (e) {
    console.error('send-deal-alert failed', e);
    return json({ error: e instanceof Error ? e.message : 'Send failed' }, 500);
  }
});
