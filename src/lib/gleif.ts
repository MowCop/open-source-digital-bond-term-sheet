import { supabase } from '@/integrations/supabase/client';
import type { CheckItem } from '@/lib/bdt-bridge';

/** Live GLEIF enrichment. The offline MOD 97-10 check remains the instant baseline. */
export const GLEIF_SEARCH_URL = 'https://search.gleif.org/#/search/simpleSearch=';
export const GLEIF_ACCESS_URL = 'https://www.gleif.org/en/lei-data/access-and-use-lei-data';

export interface GleifRecord {
  found: boolean;
  legalName?: string;
  entityStatus?: string;
  registrationStatus?: string;
  nextRenewalDate?: string;
  country?: string;
  error?: string;
}

export async function lookupLeis(leis: string[]): Promise<Record<string, GleifRecord>> {
  const { data, error } = await supabase.functions.invoke('gleif-lookup', { body: { leis } });
  if (error) throw error;
  return (data?.results ?? {}) as Record<string, GleifRecord>;
}

const norm = (s: string) =>
  s.toUpperCase()
    .replace(/[.,'’()&-]/g, ' ')
    .replace(/\b(THE|OF|PLC|AG|SA|SE|NV|BV|AB|ASA|SPA|LTD|LIMITED|INC|LLC|LP|CORP|CORPORATION|GMBH|CO|COMPANY)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Loose legal-name match: identical after normalisation, or one contains the other. */
export function namesMatch(entered: string, registered: string): boolean {
  const a = norm(entered), b = norm(registered);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Turn a registry record into a Deal Checker entry for one party. */
export function gleifCheck(partyName: string, lei: string, rec: GleifRecord | undefined): CheckItem | null {
  if (!rec) return null;
  const who = partyName || 'unnamed party';
  if (rec.error) return { l: 'warn', t: `GLEIF lookup unavailable for ${who}`, d: `${lei}: ${rec.error}. Offline check-digit test still applies.` };
  if (!rec.found) return { l: 'fail', t: `LEI not found in GLEIF: ${who}`, d: `${lei} is not registered in the Global LEI Index.` };
  if (rec.entityStatus && rec.entityStatus !== 'ACTIVE')
    return { l: 'fail', t: `GLEIF entity not active: ${who}`, d: `${lei} entity status is ${rec.entityStatus}.` };
  if (rec.registrationStatus === 'LAPSED' || rec.registrationStatus === 'RETIRED' || rec.registrationStatus === 'ANNULLED')
    return { l: 'warn', t: `LEI registration ${rec.registrationStatus.toLowerCase()}: ${who}`, d: `${lei} needs renewal${rec.nextRenewalDate ? ` (was due ${rec.nextRenewalDate.slice(0, 10)})` : ''}.` };
  if (partyName && rec.legalName && !namesMatch(partyName, rec.legalName))
    return { l: 'warn', t: `LEI name mismatch: ${who}`, d: `GLEIF registers ${lei} to "${rec.legalName}".` };
  return { l: 'pass', t: `LEI verified in GLEIF: ${who}`, d: `${rec.legalName} · ${rec.registrationStatus || 'ISSUED'}` };
}

export interface LeiCandidate {
  lei: string;
  legalName: string;
  country: string;
  entityStatus: string;
  registrationStatus: string;
  best?: boolean;
}

const searchCache = new Map<string, Promise<LeiCandidate[]>>();

/** Search GLEIF by legal name (cached per name). Never throws: an outage returns []. */
export function searchLeiByName(name: string): Promise<LeiCandidate[]> {
  const key = name.trim().toUpperCase();
  if (key.length < 2) return Promise.resolve([]);
  if (!searchCache.has(key)) {
    const p = supabase.functions
      .invoke('gleif-lookup', { body: { search: { name: name.trim() } } })
      .then(({ data, error }) => (error ? [] : ((data?.candidates ?? []) as LeiCandidate[])))
      .catch(() => [] as LeiCandidate[]);
    p.then(r => { if (r.length === 0) searchCache.delete(key); });
    searchCache.set(key, p);
  }
  return searchCache.get(key)!;
}

/** Active entities first, name matches first; flag a single active name-matching candidate as best. Max 5. */
export function rankCandidates(name: string, list: LeiCandidate[]): LeiCandidate[] {
  const score = (c: LeiCandidate) =>
    (c.entityStatus === 'ACTIVE' ? 2 : 0) + (c.registrationStatus === 'ISSUED' ? 1 : 0) + (namesMatch(name, c.legalName) ? 4 : 0);
  const sorted = [...list].sort((a, b) => score(b) - score(a)).slice(0, 5).map(c => ({ ...c, best: false }));
  const strong = sorted.filter(c => c.entityStatus === 'ACTIVE' && namesMatch(name, c.legalName));
  if (strong.length === 1) strong[0].best = true;
  return sorted;
}

/** Deal Checker warning for a named party with no LEI. */
export function missingLeiCheck(partyName: string, count: number): CheckItem | null {
  if (!partyName.trim() || count === 0) return null;
  return {
    l: 'warn',
    t: `Party ${partyName} has no LEI — ${count} GLEIF match${count === 1 ? '' : 'es'} found`,
    d: 'Open the party in the Fill tab and pick a suggestion under the LEI box.',
  };
}
