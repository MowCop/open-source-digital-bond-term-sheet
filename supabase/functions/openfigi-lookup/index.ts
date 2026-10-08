import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * openfigi-lookup — map ISINs to FIGIs via the public OpenFIGI v3 mapping API.
 * Works without a key (low rate limit); uses OPENFIGI_API_KEY if configured.
 * Input  : { isins: string[] }  (max 10, 12 chars A-Z0-9)
 * Output : { results: Record<isin, { found, figi?, compositeFigi?, shareClassFigi?, name?, ticker?, securityType?, marketSector?, error? }> }
 */
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: { isins?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!Array.isArray(body.isins) || body.isins.length === 0 || body.isins.length > 10)
    return json({ error: 'isins must be an array of 1-10 ISINs' }, 400);
  const isins = [...new Set(body.isins.map(x => String(x).trim().toUpperCase()))];
  if (isins.some(i => !ISIN_RE.test(i))) return json({ error: 'Each ISIN must be 12 characters' }, 400);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = Deno.env.get('OPENFIGI_API_KEY');
  if (key) headers['X-OPENFIGI-APIKEY'] = key;

  const results: Record<string, unknown> = {};
  try {
    const r = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST', headers,
      body: JSON.stringify(isins.map(idValue => ({ idType: 'ID_ISIN', idValue }))),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error(`OpenFIGI failed [${r.status}]: ${t}`);
      for (const i of isins) results[i] = { found: false, error: `OpenFIGI returned ${r.status}` };
      return json({ results });
    }
    const arr = await r.json() as Array<{ data?: Array<Record<string, string>>; warning?: string; error?: string }>;
    isins.forEach((isin, n) => {
      const e = arr[n];
      if (e?.error) { results[isin] = { found: false, error: e.error }; return; }
      const d = e?.data?.[0];
      if (!d) { results[isin] = { found: false }; return; }
      results[isin] = {
        found: true, figi: d.figi, compositeFigi: d.compositeFIGI, shareClassFigi: d.shareClassFIGI,
        name: d.name, ticker: d.ticker, securityType: d.securityType, marketSector: d.marketSector,
      };
    });
  } catch (err) {
    for (const i of isins) results[i] = { found: false, error: 'OpenFIGI unreachable' };
    console.error(err);
  }
  return json({ results });
});
