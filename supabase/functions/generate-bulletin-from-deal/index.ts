import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runModel, pickModel } from '../_shared/ai-model.ts';
import { z } from 'npm:zod@3';
import { BULLETIN_PROMPT, splitAnnouncement, sourcedLegalNotices, legalFooter } from './format.ts';

/**
 * generate-bulletin-from-deal
 * ─────────────────────────────────────────────────────────────────────────────
 * Input  : { dealId: string }
 * Output : { subject: string, body: string }   // body is HTML (prose + term sheet table)
 * ─────────────────────────────────────────────────────────────────────────────
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const InputSchema = z.object({
  dealId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/), model: z.string().max(100).optional(),
  sourceAnnouncement: z.string().max(30000).optional(),
  docs: z.array(z.object({ name: z.string().max(255), text: z.string().max(120000) })).max(6).default([]),
}).refine(p => p.docs.reduce((n, d) => n + d.text.length, 0) <= 120000, 'Document excerpts are too long');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims || claimsData.claims.role !== 'authenticated') {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    const isAdmin = (roles ?? []).some(r => r.role === 'master_admin' || r.role === 'syndicate_admin');
    if (!isAdmin) return jsonResponse({ error: 'forbidden' }, 403);

    let input: unknown;
    try { input = await req.json(); }
    catch { return jsonResponse({ error: 'invalid_json' }, 400); }
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) return jsonResponse({ error: 'invalid_input', message: parsed.error.message }, 400);
    const payload = parsed.data;
    const { dealId } = payload;

    const { data: deal, error: dealErr } = await supabase.from('deals').select('*').eq('id', dealId).maybeSingle();
    if (dealErr) return jsonResponse({ error: 'db_error', message: dealErr.message }, 500);
    if (!deal) return jsonResponse({ error: 'deal_not_found' }, 404);


    const source = splitAnnouncement(payload.sourceAnnouncement ?? '');
    const ai = await runModel({ model: pickModel(payload.model), system: BULLETIN_PROMPT, user: JSON.stringify({
      stage: deal.stage,
      authoritativeTermSheet: deal.bdt_state,
      legacyDeal: deal.bdt_state ? null : deal,
      sourceAnnouncement: source.announcement,
      documents: payload.docs,
    }), maxTokens: 8000 });
    if (!ai.ok) return jsonResponse({ error: ai.error, message: ai.message }, ai.status);
    let raw: string = ai.text;
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let obj: { subject?: unknown; body?: unknown; legalNotices?: unknown };
    try { obj = JSON.parse(raw); }
    catch {
      return jsonResponse({ error: 'ai_parse_failed', message: 'AI returned invalid JSON.' }, 502);
    }

    const subject = typeof obj.subject === 'string' && obj.subject.trim() ? obj.subject.trim() : `${deal.issuer_name} ${deal.currency} ${deal.size} ${deal.tenor}`.trim();
    if (typeof obj.body !== 'string' || !obj.body.trim()) return jsonResponse({ error: 'ai_parse_failed', message: 'No bulletin content returned.' }, 502);
    const notices = source.legal ? source.legal.split(/\n\s*\n/).filter(p => p.trim()) : sourcedLegalNotices(obj.legalNotices, payload.docs);
    const body = obj.body + legalFooter(notices);

    return jsonResponse({ subject, body, hasLegalNotices: notices.length > 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('generate-bulletin-from-deal error:', message);
    return jsonResponse({ error: 'generation_failed', message }, 500);
  }
});