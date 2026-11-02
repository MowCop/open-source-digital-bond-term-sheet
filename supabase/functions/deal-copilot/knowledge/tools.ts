/**
 * Deal Checker resources exposed to Co-Pilot (coordinator + specialists).
 * Same sources as the Deal Checker: live checker results (sent by the browser),
 * GLEIF + OpenFIGI registries, TARGET2/London/US holiday calendars, and the
 * ICMA/BDT reference library. All results are evidence for review; nothing here
 * edits a deal.
 */
import { LIBRARY } from "./library.ts";

// Mirrors src/lib/bondValidator.ts (CALENDAR_MAX_YEAR 2027). Update both together.
export const CALENDAR_MAX_YEAR = 2027;
const CAL: Record<string, Set<string>> = {
  TARGET2: new Set([
    '2024-01-01','2024-03-29','2024-04-01','2024-05-01','2024-12-25','2024-12-26',
    '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-12-25','2025-12-26',
    '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-25','2026-12-28',
    '2027-01-01','2027-03-26','2027-03-29','2027-05-01','2027-12-25','2027-12-27',
  ]),
  LONDON: new Set([
    '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
    '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
    '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28',
    '2027-01-01','2027-03-26','2027-03-29','2027-05-03','2027-05-31','2027-08-30','2027-12-27','2027-12-28',
  ]),
  US: new Set([
    '2024-01-01','2024-01-15','2024-02-19','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-10-14','2024-11-11','2024-11-28','2024-12-25',
    '2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25',
    '2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25',
    '2027-01-01','2027-01-18','2027-02-15','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-10-11','2027-11-11','2027-11-25','2027-12-24',
  ]),
};
const CCY_CAL: Record<string, string[]> = { EUR: ['TARGET2'], GBP: ['LONDON'], USD: ['US'] };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const okDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));

export function checkCalendar(input: { date: string; calendars?: string[]; currency?: string; settlementLag?: number }) {
  const date = String(input.date ?? '');
  if (!okDate(date)) throw new Error('date must be YYYY-MM-DD');
  const cals = (input.calendars?.length ? input.calendars : CCY_CAL[String(input.currency ?? '').toUpperCase()] ?? [])
    .map((c) => String(c).toUpperCase()).filter((c) => CAL[c]);
  if (!cals.length) throw new Error('Supply calendars (TARGET2, LONDON, US) or currency EUR/GBP/USD');
  const year = Number(date.slice(0, 4));
  const isBiz = (d: Date) => d.getUTCDay() % 6 !== 0 && cals.every((c) => !CAL[c].has(iso(d)));
  const d = new Date(date + 'T00:00:00Z');
  const holidays = cals.filter((c) => CAL[c].has(date));
  const out: Record<string, unknown> = {
    date, calendars: cals, businessDay: isBiz(d), weekend: d.getUTCDay() % 6 === 0, holidayIn: holidays,
    coverage: year > CALENDAR_MAX_YEAR || year < 2024 ? `Outside calendar coverage 2024–${CALENDAR_MAX_YEAR}; result unreliable` : `Covered 2024–${CALENDAR_MAX_YEAR}`,
  };
  const lag = input.settlementLag;
  if (lag !== undefined) {
    if (!Number.isInteger(lag) || lag < 0 || lag > 10) throw new Error('settlementLag must be 0-10');
    const s = new Date(d); let n = 0, guard = 0;
    while (n < lag && guard++ < 40) { s.setUTCDate(s.getUTCDate() + 1); if (isBiz(s)) n++; }
    out.settlementDate = iso(s); out.settlementLag = `T+${lag}`;
  }
  // Following/Modified Following roll for a non-business day.
  if (!out.businessDay) {
    const f = new Date(d); let g = 0; while (!isBiz(f) && g++ < 15) f.setUTCDate(f.getUTCDate() + 1);
    const p = new Date(d); g = 0; while (!isBiz(p) && g++ < 15) p.setUTCDate(p.getUTCDate() - 1);
    out.following = iso(f); out.modifiedFollowing = f.getUTCMonth() === d.getUTCMonth() ? iso(f) : iso(p);
  }
  out.source = 'VDR Deal Checker holiday tables (TARGET2/ECB, London/BoE, US Federal/SIFMA)';
  return out;
}

const LEI_RE = /^[A-Z0-9]{20}$/;
async function gleif(url: string) {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(8000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GLEIF returned ${r.status}`);
  return (await r.json())?.data;
}
export async function lookupLei(input: { lei: string }) {
  const lei = String(input.lei ?? '').trim().toUpperCase();
  if (!LEI_RE.test(lei)) throw new Error('LEI must be 20 characters A-Z/0-9');
  try {
    const d = await gleif(`https://api.gleif.org/api/v1/lei-records/${lei}`);
    if (!d) return { lei, found: false, source: 'GLEIF (live)' };
    const a = d.attributes ?? {};
    return { lei, found: true, legalName: a.entity?.legalName?.name ?? '', entityStatus: a.entity?.status ?? '',
      registrationStatus: a.registration?.status ?? '', nextRenewalDate: a.registration?.nextRenewalDate ?? '',
      country: a.entity?.legalAddress?.country ?? '', source: 'GLEIF (live)', checkedAt: new Date().toISOString() };
  } catch (e) { return { lei, found: false, error: e instanceof Error ? e.message : 'GLEIF unreachable', source: 'GLEIF (live)' }; }
}
export async function searchLei(input: { name: string }) {
  const name = String(input.name ?? '').trim();
  if (name.length < 2 || name.length > 200) throw new Error('name must be 2-200 characters');
  try {
    const q = (f: string) => gleif(`https://api.gleif.org/api/v1/lei-records?filter[${f}]=${encodeURIComponent(name)}&page[size]=5`);
    let rows = (await q('entity.legalName')) ?? [];
    if (!rows.length) rows = (await q('fulltext')) ?? [];
    return { name, candidates: rows.map(({ attributes: a }: any) => ({ lei: a.lei, legalName: a.entity?.legalName?.name ?? '',
      country: a.entity?.legalAddress?.country ?? '', entityStatus: a.entity?.status ?? '', registrationStatus: a.registration?.status ?? '' })),
      note: 'Suggestions only; a human must pick and enter an LEI.', source: 'GLEIF (live)' };
  } catch (e) { return { name, candidates: [], error: e instanceof Error ? e.message : 'GLEIF unreachable' }; }
}
export async function lookupFigi(input: { isin: string }) {
  const isin = String(input.isin ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) throw new Error('ISIN must be 12 characters');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = (globalThis as any).Deno?.env.get('OPENFIGI_API_KEY'); if (key) headers['X-OPENFIGI-APIKEY'] = key;
  try {
    const r = await fetch('https://api.openfigi.com/v3/mapping', { method: 'POST', headers, signal: AbortSignal.timeout(8000),
      body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]) });
    if (!r.ok) return { isin, found: false, error: `OpenFIGI returned ${r.status}`, source: 'OpenFIGI (live)' };
    const e = (await r.json())?.[0]; const d = e?.data?.[0];
    if (!d) return { isin, found: false, error: e?.error, source: 'OpenFIGI (live)' };
    return { isin, found: true, figi: d.figi, compositeFigi: d.compositeFIGI, shareClassFigi: d.shareClassFIGI, name: d.name,
      ticker: d.ticker, securityType: d.securityType, marketSector: d.marketSector, source: 'OpenFIGI (live)', checkedAt: new Date().toISOString() };
  } catch { return { isin, found: false, error: 'OpenFIGI unreachable', source: 'OpenFIGI (live)' }; }
}

/** Keyword search over the bundled ICMA/BDT/checker library; returns top passages with source. */
export function searchReferenceLibrary(input: { query: string; sourceId?: string; limit?: number }) {
  const query = String(input.query ?? '').trim().toLowerCase();
  if (query.length < 2) throw new Error('query must be at least 2 characters');
  const terms = [...new Set(query.split(/[^a-z0-9€$£%.-]+/).filter((t) => t.length > 1))];
  const docs = input.sourceId ? LIBRARY.filter((d) => d.id === input.sourceId) : LIBRARY;
  const hits: { score: number; source: string; title: string; passage: string; sourceId: string }[] = [];
  for (const d of docs) {
    const size = 1400;
    for (let i = 0; i < d.text.length; i += 1000) {
      const p = d.text.slice(i, i + size); const low = p.toLowerCase();
      let score = low.includes(query) ? 10 : 0;
      for (const t of terms) if (low.includes(t)) score += 1 + Math.min(3, low.split(t).length - 2);
      if (score > 0) hits.push({ score, source: d.source, title: d.title, passage: p, sourceId: d.id });
    }
  }
  // Older handbook extracts must not displace the preferred edition. Explicit
  // sourceId searches still permit historical research without changing priority.
  const priority = (id: string) => id === 'icma-handbook-2026' ? 1 : id === 'icma-a8' ? -1 : 0;
  hits.sort((a, b) => priority(b.sourceId) - priority(a.sourceId) || b.score - a.score);
  return { query, sources: LIBRARY.map((d) => ({ id: d.id, title: d.title })), results: hits.slice(0, Math.min(6, input.limit ?? 4)),
    note: 'The complete ICMA Primary Market Handbook, last updated May 2026 (icma-handbook-2026), is the preferred handbook reference and prevails over older handbook editions where they overlap or conflict. Appendix A8 (icma-a8, Sept 2018) is historical context only. Applicable law and transaction legal documentation still prevail; library text is not legal advice.' };
}

export type LiveCheck = { l: 'pass' | 'warn' | 'fail'; t: string; d?: string; src?: string; ignored?: boolean };
export function readLiveChecks(live: LiveCheck[] | undefined) {
  if (!live?.length) return { available: false, note: 'No live Deal Checker results were sent with this request (term sheet not open in the browser). Use checkDeal for the saved-terms baseline.' };
  const n = (l: string) => live.filter((c) => c.l === l && !c.ignored).length;
  return { available: true, provenance: 'Live Deal Checker in the user\'s browser; may include unsaved Fill edits.',
    tally: { pass: n('pass'), warn: n('warn'), fail: n('fail'), ignored: live.filter((c) => c.ignored).length }, checks: live };
}

const UA = { 'User-Agent': 'VirtualDealRoom research contact@eurobondmarkets.com', Accept: 'application/json' };
/** Free public sources: SEC EDGAR full-text search + Wikipedia summary. Live, labelled by source and time. */
export async function searchPublicSources(input: { query: string }) {
  const q = String(input.query ?? '').trim().slice(0, 200);
  if (!q) throw new Error('query required');
  const retrievedAt = new Date().toISOString();
  const out: Record<string, unknown> = { query: q, retrievedAt, note: 'Public sources, not independently verified; cite source and date.' };
  try {
    const r = await fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent('"' + q + '"')}`, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const hits = ((await r.json())?.hits?.hits ?? []).slice(0, 5);
      out.edgar = hits.map((h: any) => ({ form: h._source?.form, filed: h._source?.file_date, entity: h._source?.display_names?.[0],
        url: h._source?.ciks?.[0] && h._id ? `https://www.sec.gov/Archives/edgar/data/${Number(h._source.ciks[0])}/${String(h._id.split(':')[0]).replace(/-/g, '')}/${h._id.split(':')[1]}` : undefined }));
    } else out.edgar = { error: `EDGAR returned ${r.status}` };
  } catch { out.edgar = { error: 'EDGAR unavailable' }; }
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g, '_'))}`, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (r.ok) { const j = await r.json(); out.wikipedia = { title: j.title, extract: j.extract, url: j.content_urls?.desktop?.page }; }
  } catch { /* optional */ }
  return out;
}

export const SUBSCRIPTION_PROVIDERS = ['moodys', 'sp', 'fitch', 'bloomberg'] as const;
/** Paid subscription sources. Demo project: the user's subscription is assumed connected, but no real
 *  API is called — output is always stamped demo so it can never pass as real ratings or research.
 *  To go live, add a per-provider API key secret and replace the demo branch. */
export function querySubscriptionSource(input: { provider: string; borrower: string; topic?: string }) {
  const provider = String(input.provider ?? '').toLowerCase();
  if (!(SUBSCRIPTION_PROVIDERS as readonly string[]).includes(provider)) throw new Error(`provider must be one of ${SUBSCRIPTION_PROVIDERS.join(', ')}`);
  const borrower = String(input.borrower ?? '').trim().slice(0, 200);
  if (!borrower) throw new Error('borrower required');
  return { demo: true, provider, borrower, topic: input.topic ?? 'credit overview', retrievedAt: new Date().toISOString(),
    label: 'Demo subscription data, illustrative only',
    connection: 'Assumed connected for this demo project; no live data was retrieved.',
    instruction: 'You may give an illustrative, clearly hypothetical answer in the style of this provider, prefixed with the label. Never present it as a real rating, outlook or research view.' };
}

const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false });
export const knowledgeSpecs = {
  readLiveChecks: { name: 'readLiveChecks', description: 'Read the current Deal Checker results (pass/warn/fail, source, user-ignored flag) exactly as the user sees them, including GLEIF/OpenFIGI, conventions, ESG and AI Deep Audit items.', input_schema: obj({}, []) },
  lookupLei: { name: 'lookupLei', description: 'Live GLEIF registry lookup of one LEI: legal name, entity and registration status, renewal date, country.', input_schema: obj({ lei: { type: 'string' } }, ['lei']) },
  searchLei: { name: 'searchLei', description: 'Live GLEIF name search returning up to 5 LEI candidates. Suggestions only.', input_schema: obj({ name: { type: 'string' } }, ['name']) },
  lookupFigi: { name: 'lookupFigi', description: 'Live OpenFIGI mapping of an ISIN to FIGI, composite and share-class FIGI, name, ticker and security type.', input_schema: obj({ isin: { type: 'string' } }, ['isin']) },
  checkCalendar: { name: 'checkCalendar', description: 'Business-day check against the Deal Checker TARGET2, London and US holiday tables (2024–2027), with Following/Modified Following roll and optional T+n settlement date. Supply calendars or currency.', input_schema: obj({ date: { type: 'string' }, calendars: { type: 'array', items: { type: 'string' } }, currency: { type: 'string' }, settlementLag: { type: 'number' } }, ['date']) },
  searchPublicSources: { name: 'searchPublicSources', description: 'Search free public sources (SEC EDGAR filings full-text search, Wikipedia) about the borrower or deal. Live, returns URLs and retrieval time.', input_schema: obj({ query: { type: 'string' } }, ['query']) },
  querySubscriptionSource: { name: 'querySubscriptionSource', description: "Query the user's paid subscription (moodys, sp, fitch, bloomberg) about the borrower. DEMO: returns illustrative-only data that must be labelled 'Demo subscription data, illustrative only'.", input_schema: obj({ provider: { type: 'string' }, borrower: { type: 'string' }, topic: { type: 'string' } }, ['provider', 'borrower']) },
  searchReferenceLibrary: { name: 'searchReferenceLibrary', description: 'Search the reference library: complete ICMA Primary Market Handbook, last updated May 2026 (preferred over older editions; sourceId icma-handbook-2026), historical September 2018 Appendix A8 pro formas, Appendix C1 (Bond Data Taxonomy: purpose, legal nature, Digital Term Sheet use), ICMA DLT and blockchain in bond markets FAQ (2022), HKMA Sept 2026 HKSAR Digital Green Bonds press release (real DLT bond example), ICMA BDT v2.0 XSD/enums/type restrictions/example, and the Deal Checker capabilities reference. Optional sourceId: icma-handbook-2026, icma-a8, icma-c1, icma-dlt-faq, hkma-digital-green-2026, checker-capabilities, bdt-xsd, bdt-enums, bdt-types, bdt-example.', input_schema: obj({ query: { type: 'string' }, sourceId: { type: 'string' }, limit: { type: 'number' } }, ['query']) },
};
export type KnowledgeTool = keyof typeof knowledgeSpecs;

export async function runKnowledgeTool(name: string, input: any, live?: LiveCheck[]): Promise<unknown | undefined> {
  switch (name) {
    case 'readLiveChecks': return readLiveChecks(live);
    case 'lookupLei': return lookupLei(input);
    case 'searchLei': return searchLei(input);
    case 'lookupFigi': return lookupFigi(input);
    case 'checkCalendar': return checkCalendar(input);
    case 'searchReferenceLibrary': return searchReferenceLibrary(input);
    case 'searchPublicSources': return searchPublicSources(input);
    case 'querySubscriptionSource': return querySubscriptionSource(input);
    default: return undefined;
  }
}
