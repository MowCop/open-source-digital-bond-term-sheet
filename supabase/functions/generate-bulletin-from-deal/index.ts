import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

const SYSTEM_PROMPT = `You are a senior fixed-income syndicate desk writer.

You will receive a JSON deal record (ICMA Bond Data Taxonomy fields). Produce a clean New Issue Bulletin in the tone of a real syndicate announcement.

Return STRICT JSON of shape:
{ "subject": string, "body": string }

Rules:
- "subject" = a short headline like "Kingdom of Nania USD 1.5bn 10Y Priced at MS+72" (use only fields present; never invent numbers).
- "body" = HTML string with TWO sections in this order:
    1. <h3>Announcement</h3> followed by 2-4 short <p> paragraphs of bulletin prose covering: issuer + rating, size/tenor/coupon, pricing summary (reoffer spread/yield/price, mid-swap), listing, governing law, bookrunners (mark the GC).
    2. <h3>Digital Term Sheet</h3> followed by <table> grouped logically (Party/Issuer, Issuance, Product). One <tr> per populated field with <th> label and <td> value. SKIP rows where the value is empty, missing, or "TBA".
- Use <strong> for the GC bookrunner. Do not invent or guess values. No markdown, no commentary, no code fences.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
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

    let payload: { dealId?: string };
    try { payload = await req.json(); }
    catch { return jsonResponse({ error: 'invalid_json' }, 400); }
    const dealId = typeof payload?.dealId === 'string' ? payload.dealId.trim() : '';
    if (!dealId) return jsonResponse({ error: 'missing_dealId' }, 400);

    const { data: deal, error: dealErr } = await supabase.from('deals').select('*').eq('id', dealId).maybeSingle();
    if (dealErr) return jsonResponse({ error: 'db_error', message: dealErr.message }, 500);
    if (!deal) return jsonResponse({ error: 'deal_not_found' }, 404);

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured');

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Deal record JSON:\n${JSON.stringify(deal, null, 2)}` },
        ],
      }),
    });

    if (res.status === 429) return jsonResponse({ error: 'rate_limit', message: 'AI rate limit reached. Try again in a moment.' }, 429);
    if (res.status === 402) return jsonResponse({ error: 'credits_exhausted', message: 'AI credits exhausted. Add credits in workspace settings.' }, 402);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? '';
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let obj: { subject?: unknown; body?: unknown };
    try { obj = JSON.parse(raw); }
    catch {
      console.error('Failed to parse AI JSON:', raw.slice(0, 400));
      return jsonResponse({ error: 'ai_parse_failed', message: 'AI returned invalid JSON.' }, 502);
    }

    const subject = typeof obj.subject === 'string' && obj.subject.trim() ? obj.subject.trim() : `${deal.issuer_name} ${deal.currency} ${deal.size} ${deal.tenor}`.trim();
    const body = typeof obj.body === 'string' && obj.body.trim() ? obj.body : '<p>No content generated.</p>';

    return jsonResponse({ subject, body });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('generate-bulletin-from-deal error:', message);
    return jsonResponse({ error: 'generation_failed', message }, 500);
  }
});