import { supabase } from '@/integrations/supabase/client';
import { bdtToDealCache, type BdtState, type CheckItem } from '@/lib/bdt-bridge';

/** OpenFIGI enrichment. The offline format/check-digit test is the instant baseline. */
export const OPENFIGI_SEARCH_URL = 'https://www.openfigi.com/search#!?simpleSearchString=';
export const OPENFIGI_REGULATIONS_URL = 'https://www.openfigi.com/about/regulations';

export interface FigiRecord {
  found: boolean;
  figi?: string;
  compositeFigi?: string;
  shareClassFigi?: string;
  name?: string;
  ticker?: string;
  securityType?: string;
  marketSector?: string;
  error?: string;
}

const val = (c: string) => (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55);
const BAD_PREFIX = ['BS', 'BM', 'GG', 'GB', 'GH', 'KY', 'VG'];

/** FIGI: 12 chars, no vowels, 3rd char G, restricted prefixes, Luhn-style check digit. */
export function validFIGI(raw: string): boolean {
  const s = (raw ?? '').trim().toUpperCase();
  if (!/^[B-DF-HJ-NP-TV-Z0-9]{2}G[B-DF-HJ-NP-TV-Z0-9]{8}[0-9]$/.test(s)) return false;
  if (BAD_PREFIX.includes(s.slice(0, 2))) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    let n = val(s[i]);
    if (i % 2 === 1) n *= 2;
    for (const d of String(n)) sum += Number(d);
  }
  return (10 - (sum % 10)) % 10 === Number(s[11]);
}

const cache = new Map<string, FigiRecord>();

/** Look up ISINs on OpenFIGI (cached). Throws only if the backend function is unreachable. */
export async function lookupFigis(isins: string[]): Promise<Record<string, FigiRecord>> {
  const want = [...new Set(isins.map(i => i.trim().toUpperCase()))].filter(Boolean);
  const missing = want.filter(i => !cache.has(i)).slice(0, 10);
  if (missing.length) {
    const { data, error } = await supabase.functions.invoke('openfigi-lookup', { body: { isins: missing } });
    if (error) throw error;
    for (const [k, v] of Object.entries((data?.results ?? {}) as Record<string, FigiRecord>)) if (!v.error) cache.set(k, v);
    return { ...Object.fromEntries(want.filter(i => cache.has(i)).map(i => [i, cache.get(i)!])), ...(data?.results ?? {}) };
  }
  return Object.fromEntries(want.map(i => [i, cache.get(i)!]));
}

const idOf = (state: BdtState, t: string) =>
  ((state.ids ?? []).find(x => x.Type === t)?.Value ?? '').trim().toUpperCase();

/** Offline + live FIGI checks for the Deal Checker. stage >= 5 means priced or later. */
export function figiChecks(state: BdtState, rec: FigiRecord | undefined): CheckItem[] {
  const out: CheckItem[] = [];
  const isin = idOf(state, 'ISIN');
  const figi = idOf(state, 'FIGI');
  const priced = (state.stage ?? 0) >= 5;
  if (figi) {
    if (!validFIGI(figi)) out.push({ l: 'fail', t: 'FIGI format invalid', d: `${figi} fails the FIGI structure or check-digit test.` });
    else out.push({ l: 'pass', t: 'FIGI format valid', d: figi });
  }
  if (isin && rec) {
    if (rec.error) out.push({ l: 'warn', t: 'OpenFIGI lookup unavailable', d: `${isin}: ${rec.error}.` });
    else if (!rec.found)
      out.push(priced
        ? { l: 'warn', t: 'ISIN not yet on OpenFIGI', d: `${isin} has no FIGI yet; FIGIs usually appear around pricing/settlement.` }
        : { l: 'pass', t: 'ISIN not yet on OpenFIGI (normal before pricing)', d: isin });
    else if (figi && rec.figi && figi !== rec.figi && figi !== rec.compositeFigi && figi !== rec.shareClassFigi)
      out.push({ l: 'warn', t: 'FIGI does not match ISIN on OpenFIGI', d: `OpenFIGI maps ${isin} to ${rec.figi} (${rec.name ?? ''}).` });
    else if (figi) out.push({ l: 'pass', t: 'FIGI matches ISIN on OpenFIGI', d: `${figi} · ${rec.name ?? ''} ${rec.ticker ?? ''}`.trim() });
    else out.push({ l: 'warn', t: 'FIGI available but not recorded', d: `OpenFIGI maps ${isin} to ${rec.figi}. Add it in the Identifier list.` });
  }
  return out;
}

/** Reporting-readiness notes (warnings only, never blocking). */
export function reportingChecks(state: BdtState): CheckItem[] {
  const out: CheckItem[] = [];
  const isin = idOf(state, 'ISIN');
  const parties = (state.parties ?? []) as Array<{ Roles?: string[]; LEIIdentifier?: string }>;
  const issuer = parties.find(p => (p.Roles ?? []).some(r => /issuer/i.test(r)));
  const issuerLei = (issuer?.LEIIdentifier ?? '').trim();
  if (!isin || !issuerLei)
    out.push({ l: 'warn', t: 'EU/UK reporting: ISIN and issuer LEI needed', d: 'MiFIR/EMIR/SFTR and UK equivalents identify the bond by ISIN and the issuer by LEI.' });
  else out.push({ l: 'pass', t: 'EU/UK reporting identifiers present', d: 'ISIN and issuer LEI recorded (MiFIR/EMIR/SFTR).' });
  let cur = '';
  try { cur = String(bdtToDealCache(state).currency ?? '').toUpperCase(); } catch { cur = ''; }
  const hasCusip = !!idOf(state, 'CUSIP');
  if (cur === 'USD' && !hasCusip && !idOf(state, 'FIGI'))
    out.push({ l: 'warn', t: 'US reporting: no CUSIP or FIGI', d: 'FINRA TRACE uses CUSIP; SEC 13F, Reg SHO and CFTC Part 17 accept FIGI as an alternative identifier.' });
  return out;
}
