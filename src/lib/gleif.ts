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
