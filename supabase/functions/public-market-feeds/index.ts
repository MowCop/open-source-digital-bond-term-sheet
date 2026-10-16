import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { XMLParser, XMLValidator } from 'npm:fast-xml-parser@5.11.2';
import { parseFedRates, parseEcbFx, parsePublicNews, type PublicMarketSnapshot } from '../_shared/public-market-data.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: false });
let cached: PublicMarketSnapshot | undefined;
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  try {
    const auth = req.headers.get('Authorization');
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) return json({ error: 'Feed service is not configured' }, 503);
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Sign in to read market feeds' }, 401);
    const client = createClient(url, key, { global: { headers: { Authorization: auth } } });
    const { data, error } = await client.auth.getClaims(auth.slice(7));
    if (error || data?.claims?.role !== 'authenticated') return json({ error: 'Sign in to read market feeds' }, 401);
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < 60_000) return json(cached);
    const snapshot: PublicMarketSnapshot = { fetchedAt: new Date().toISOString(), rates: [], headlines: [], errors: [] };
    const read = async (url: string, xml = false) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: xml ? 'application/xml, text/xml, application/rss+xml' : 'application/json' } });
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > 2_000_000) throw new Error('Source response is too large');
      if (!xml) return JSON.parse(body);
      if (/<!DOCTYPE|<!ENTITY/i.test(body) || XMLValidator.validate(body) !== true) throw new Error('Source returned invalid XML');
      return parser.parse(body);
    };
    const sources = [
      { name: 'New York Fed SOFR', run: async () => { const rows = parseFedRates(await read('https://markets.newyorkfed.org/api/rates/secured/sofr/last/5.json'), 'SOFR'); if (!rows.length) throw new Error('No published rate returned'); snapshot.rates.push(...rows); } },
      { name: 'New York Fed EFFR', run: async () => { const rows = parseFedRates(await read('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/5.json'), 'EFFR'); if (!rows.length) throw new Error('No published rate returned'); snapshot.rates.push(...rows); } },
      { name: 'ECB exchange rates', run: async () => { const rows = parseEcbFx(await read('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', true)); if (!rows.length) throw new Error('No published exchange rates returned'); snapshot.rates.push(...rows); } },
      { name: 'ECB news', run: async () => { const rows = parsePublicNews(await read('https://www.ecb.europa.eu/rss/press.html', true), 'European Central Bank', 'www.ecb.europa.eu'); if (!rows.length) throw new Error('No published headlines returned'); snapshot.headlines.push(...rows); } },
      { name: 'Federal Reserve news', run: async () => { const rows = parsePublicNews(await read('https://www.federalreserve.gov/feeds/press_all.xml', true), 'Federal Reserve', 'www.federalreserve.gov'); if (!rows.length) throw new Error('No published headlines returned'); snapshot.headlines.push(...rows); } },
    ];
    await Promise.all(sources.map(async source => { try { await source.run(); } catch (error) { snapshot.errors.push({ source: source.name, message: error instanceof Error ? error.message : 'Source unavailable' }); } }));
    snapshot.rates.sort((a, b) => a.id.localeCompare(b.id));
    snapshot.headlines.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    if (snapshot.rates.length || snapshot.headlines.length) cached = snapshot;
    return json(snapshot);
  } catch { return json({ error: 'Market feeds could not be loaded; please retry' }, 500); }
});