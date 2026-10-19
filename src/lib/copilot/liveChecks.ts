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

/** Ask Deal Co-Pilot about one check; DealCopilot listens, opens and sends it as a chat turn. */
export const COPILOT_ASK = 'vdr:copilot-ask';
export type CopilotAsk = { dealId: string; text: string };
export function askText(c: Pick<CheckItem, 'l' | 't' | 'd' | 'src'>): string {
  const level = c.l === 'fail' ? 'fail' : 'warning';
  return `Explain this Deal Checker ${level} and how to resolve it: "${c.t}"${c.d ? ` (${c.d.slice(0, 600)})` : ''} [source: ${c.src ?? 'bdt'}]. Use the Deal Checker tools and deal documents; if the evidence supports a specific value, propose it as a correction for term-editor approval, otherwise say what evidence is missing.`;
}
export function askCopilot(dealId: string, c: Pick<CheckItem, 'l' | 't' | 'd' | 'src'>) {
  window.dispatchEvent(new CustomEvent<CopilotAsk>(COPILOT_ASK, { detail: { dealId, text: askText(c) } }));
}
