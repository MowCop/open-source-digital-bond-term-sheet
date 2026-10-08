import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * gleif-lookup — live LEI enrichment from the public GLEIF API (no key).
 * Input  : { leis: string[] }  (max 25, each 20 chars A-Z0-9)
 * Output : { results: Record<lei, { found, legalName?, entityStatus?, registrationStatus?, nextRenewalDate?, country? , error? }> }
 * The instant offline MOD 97-10 check stays in the client; this only adds registry facts.
 */
const LEI_RE = /^[A-Z0-9]{20}$/;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: { leis?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!Array.isArray(body.leis) || body.leis.length === 0 || body.leis.length > 25)
    return json({ error: 'leis must be an array of 1-25 codes' }, 400);
  const leis = [...new Set(body.leis.map(x => String(x).trim().toUpperCase()))];
  if (leis.some(l => !LEI_RE.test(l))) return json({ error: 'Each LEI must be 20 characters A-Z/0-9' }, 400);

  const results: Record<string, unknown> = {};
  await Promise.all(leis.map(async (lei) => {
    try {
      const r = await fetch(`https://api.gleif.org/api/v1/lei-records/${lei}`, {
        headers: { Accept: 'application/vnd.api+json' },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 404) { results[lei] = { found: false }; return; }
      if (!r.ok) { results[lei] = { found: false, error: `GLEIF returned ${r.status}` }; return; }
      const a = (await r.json())?.data?.attributes ?? {};
      results[lei] = {
        found: true,
        legalName: a.entity?.legalName?.name ?? '',
        entityStatus: a.entity?.status ?? '',
        registrationStatus: a.registration?.status ?? '',
        nextRenewalDate: a.registration?.nextRenewalDate ?? '',
        country: a.entity?.legalAddress?.country ?? '',
      };
    } catch (e) {
      results[lei] = { found: false, error: e instanceof Error ? e.message : 'Lookup failed' };
    }
  }));

  return json({ results });
});
