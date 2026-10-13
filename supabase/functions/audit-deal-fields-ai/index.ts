import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { runModel, pickModel } from '../_shared/ai-model.ts';

/**
 * audit-deal-fields-ai — on-demand AI Deep Audit.
 * Compares the live Fill field values with the text of the deal's stored documents.
 * Every finding is a warning; nothing is ever applied automatically.
 */

const SYSTEM = `You are a bond syndicate compliance reviewer. You receive (a) the current term sheet field values, each with a path and label, and (b) excerpts from the deal's legal documents (offering circular, supplement, pricing supplement, final terms).

Find ONLY genuine discrepancies between the term sheet fields and the documents, and material terms in the documents that the term sheet fields omit (call/redemption features, step-ups, ESG use-of-proceeds or reporting commitments, governing law, denominations, dates, coupon, size, identifiers).

Return JSON only:
{"findings":[{"title":string,"detail":string,"fieldPath":string,"currentValue":string,"docValue":string,"docQuote":string}]}

Rules:
- fieldPath must be one of the supplied paths, or "" when no single field applies.
- docValue: the exact value to put in that field ONLY when the document states it unambiguously in the same format the field uses; otherwise "".
- docQuote: a short verbatim quote (max 200 chars) from the documents supporting the finding.
- Never invent values. Do not report matching values. Do not comment on fields the documents do not address. Max 15 findings. Empty list if nothing is wrong.`;

const Body = z.object({
  fields: z.array(z.object({ path: z.string().max(300), label: z.string().max(200), value: z.string().max(2000) })).max(400),
  docs: z.array(z.object({ name: z.string().max(300), text: z.string().max(120_000) })).min(1).max(10),
  model: z.string().optional(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: c, error: ce } = await sb.auth.getClaims(auth.slice(7));
    if (ce || c?.claims?.role !== 'authenticated') return json({ error: 'unauthorized' }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'invalid_input', message: parsed.error.message }, 400);
    const { fields, docs, model } = parsed.data;
    const total = docs.reduce((n, d) => n + d.text.length, 0);
    if (total > 200_000) return json({ error: 'text_too_long', message: 'Document excerpts are too long.' }, 413);

    const user = `TERM SHEET FIELDS (path | label | value):\n${fields.map(f => `${f.path} | ${f.label} | ${f.value || '(empty)'}`).join('\n')}\n\nDOCUMENT EXCERPTS:\n${docs.map(d => `=== ${d.name} ===\n${d.text}`).join('\n\n')}`;
    const ai = await runModel({ model: pickModel(model), system: SYSTEM, user, maxTokens: 8000 });
    if (!ai.ok) return json({ error: ai.error, message: ai.message }, ai.status);

    let raw: { findings?: unknown[] } = {};
    try { raw = JSON.parse(ai.text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')); } catch { console.error('bad AI JSON', ai.text.slice(0, 300)); }
    const paths = new Set(fields.map(f => f.path));
    const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    const findings = (Array.isArray(raw.findings) ? raw.findings : []).slice(0, 15).map((f: any) => {
      const fieldPath = paths.has(s(f?.fieldPath, 300)) ? s(f.fieldPath, 300) : '';
      return {
        title: s(f?.title, 200), detail: s(f?.detail, 800), fieldPath,
        currentValue: s(f?.currentValue, 300), docValue: fieldPath ? s(f?.docValue, 300) : '', docQuote: s(f?.docQuote, 300),
      };
    }).filter(f => f.title);
    return json({ findings });
  } catch (e) {
    console.error('audit-deal-fields-ai', e);
    return json({ error: 'audit_failed', message: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
