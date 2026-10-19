import type { CheckItem } from '@/lib/bdt-bridge';

/** Latest Deal Checker results per deal, published by UnifiedDealChecker and sent with Co-Pilot chat turns. */
export type LiveCheck = { l: CheckItem['l']; t: string; d?: string; src?: string; ignored?: boolean };
const store = new Map<string, LiveCheck[]>();

export function toLiveChecks(checks: CheckItem[], isIgnored: (c: CheckItem) => boolean): LiveCheck[] {
  return checks.slice(0, 120).map((c) => ({
    l: c.l,
    t: c.t.slice(0, 300),
    ...(c.d ? { d: c.d.slice(0, 600) } : {}),
    src: c.src ?? 'bdt',
    ...(c.l === 'warn' && isIgnored(c) ? { ignored: true } : {}),
  }));
}
export const publishLiveChecks = (dealId: string, checks: LiveCheck[]) => { store.set(dealId, checks); };
export const getLiveChecks = (dealId: string): LiveCheck[] | undefined => store.get(dealId);
