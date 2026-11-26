/** Evolving execution terms (talk, size states, skew). Pure: no UI or database. */
import type { BdtState, CheckItem } from '../bdt-bridge';
import type { DealWorkspace } from '../dealWorkspace';
import { usdEquivalent, aggregateUsdEquivalent, fxWarnings } from '../dealWorkspace';

export interface Talk { text: string; low: number | null; high: number | null; unit: 'pct' | 'price' | 'bp' | null; area: boolean; wpir: boolean }
/** "4.75% area", "99.25-99.50", "4.50% +/- 5bp WPIR", "MS+95 area" → numeric range; text is always kept verbatim. */
export function parseTalk(raw: string): Talk {
  const text = raw.trim(), t = text.replace(/\s+/g, ' ');
  const area = /\barea\b/i.test(t), wpir = /\bWPIR\b/i.test(t);
  const num = (s: string) => Number(s.replace(',', '.'));
  const unitOf = (n: number, pct: boolean, bp: boolean): Talk['unit'] => pct ? 'pct' : bp ? 'bp' : n >= 50 ? 'price' : null;
  const pm = t.match(/(-?\d+(?:[.,]\d+)?)\s*(%)?\s*(?:\+\/-|±|\+\/−)\s*(\d+(?:[.,]\d+)?)\s*(bps?|%)?/i);
  if (pm) {
    const mid = num(pm[1]), d = num(pm[3]), pct = !!pm[2];
    const delta = /bp/i.test(pm[4] ?? '') && pct ? d / 100 : d;
    return { text, low: +(mid - delta).toFixed(6), high: +(mid + delta).toFixed(6), unit: unitOf(mid, pct, /^(MS|UST|T)\s*\+/i.test(t) || (!pct && /bp/i.test(t))), area, wpir };
  }
  const range = t.match(/(-?\d+(?:[.,]\d+)?)\s*(%)?\s*(?:-|–|to)\s*(-?\d+(?:[.,]\d+)?)\s*(%)?/i);
  if (range) { const a = num(range[1]), b = num(range[3]), pct = !!(range[2] || range[4]); return { text, low: Math.min(a, b), high: Math.max(a, b), unit: unitOf(a, pct, /bp|MS|UST/i.test(t)), area, wpir }; }
  const one = t.match(/(-?\d+(?:[.,]\d+)?)\s*(%)?/);
  if (one) { const n = num(one[1]), pct = !!one[2]; return { text, low: n, high: n, unit: unitOf(n, pct, /bp|MS\s*\+|UST\s*\+|T\s*\+/i.test(t)), area, wpir }; }
  return { text, low: null, high: null, unit: null, area, wpir };
}
/** Market practice: USD deals talk spread vs UST, EUR (and others) vs mid-swaps. Saved user override wins. */
export function spreadConvention(f: Record<string, string>): string {
  return f['x:spreadConvention'] || (f['IssuanceDataGroup/Issuance/SpecifiedCurrency'] === 'USD' ? 'UST' : 'MS');
}
export type SizeState = { kind: 'numeric'; amount: number } | { kind: 'benchmark' | 'target' | 'wng' | 'text'; text: string };
export function sizeState(raw: string): SizeState {
  const t = raw.trim();
  if (/^\d+(?:\.\d+)?$/.test(t)) return { kind: 'numeric', amount: Number(t) };
  if (/\b(wng|will not grow)\b/i.test(t)) return { kind: 'wng', text: t };
  if (/\btarget\b/i.test(t)) return { kind: 'target', text: t };
  if (/benchmark/i.test(t) || !t) return { kind: 'benchmark', text: t || 'Benchmark' };
  return { kind: 'text', text: t };
}
export const SKEW_OPTIONS = ['Skewed to the long end', 'Skewed to the short end', 'Evenly split', 'Long end weighted'];
const fmt = (n: number) => n >= 1e9 ? `${+(n / 1e9).toFixed(3)}bn` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}m` : String(n);
/** Relative weights per tranche: real amounts when all known, otherwise an indication from the skew wording. */
export function skewWeights(ws: DealWorkspace | null, skew: string): number[] {
  const t = ws?.tranches ?? []; if (!t.length) return [];
  if (t.every(x => x.amount != null && x.amount > 0)) { const s = t.reduce((a, x) => a + (x.amount ?? 0), 0); return t.map(x => (x.amount ?? 0) / s); }
  const n = t.length, raw = t.map((_, i) => /long/i.test(skew) ? i + 1 : /short/i.test(skew) ? n - i : 1);
  const s = raw.reduce((a, b) => a + b, 0); return raw.map(x => x / s);
}
/** Deal size headline: USD-equivalent when currencies differ, otherwise the currency size state, plus skew. */
export function sizeHeadline(state: BdtState, ws: DealWorkspace | null): { text: string; perCurrency: string[]; fx: string[]; usd: number | null } {
  const f = state.f, ccys = [...new Set((ws?.tranches ?? []).map(t => t.currency).filter(Boolean))];
  const ccy = ccys[0] || f['IssuanceDataGroup/Issuance/SpecifiedCurrency'] || '';
  const skew = f['x:sizeSkew']?.trim();
  const totals: Record<string, { sum: number; unknown: number }> = {};
  for (const t of ws?.tranches ?? []) { if (!t.currency) continue; const e = (totals[t.currency] ??= { sum: 0, unknown: 0 }); if (t.amount == null) e.unknown++; else e.sum += t.amount; }
  const perCurrency = Object.entries(totals).map(([c, v]) => `${c} ${v.unknown || !v.sum ? 'benchmark' : fmt(v.sum)}`);
  const recordedUsd = Number(f['x:usdEquivalent']);
  const usd = Number.isFinite(recordedUsd) && recordedUsd > 0 ? recordedUsd : ws ? aggregateUsdEquivalent(ws) : null;
  const fx = ws ? Object.entries(ws.fx ?? {}).map(([c, r]) => `${c}: ${r.usdPerUnit} (${r.source || 'manual'}, ${r.asOf})`) : [];
  let main: string;
  if (ccys.length > 1) main = usd != null ? `USD ${fmt(usd)} equivalent` : 'USD equivalent benchmark';
  else {
    const total = Number(f['IssuanceDataGroup/Issuance/TotalAggregateAmount/Value']);
    const s = f['x:sizeMsg']?.trim();
    main = Number.isFinite(total) && total > 0 && !s ? `${ccy} ${fmt(total)}` : `${ccy} ${s || 'benchmark'}`.trim();
  }
  return { text: [main, skew].filter(Boolean).join(', '), perCurrency, fx: [...fx, ...(ws ? fxWarnings(ws) : [])], usd: usd ?? (ws ? usdEquivalent(ws).total : null) };
}
/** Pricing term sheet completeness for the whole deal (in addition to per-tranche template checks). */
export function pricingDealCompleteness(state: BdtState, ws: DealWorkspace | null): CheckItem[] {
  if (state.stage < 5 || !state.fieldMeta) return [];
  const out: CheckItem[] = [], m = state.fieldMeta;
  const notSet = (k: string) => m[k]?.status !== 'set';
  (ws?.tranches ?? []).forEach((t, i) => {
    const pre = i === 0 ? '' : `tranche:${t.id}:`;
    if (t.amount == null || !(t.amount > 0)) out.push({ l: 'fail', src: 'bdt', t: `Pricing term sheet incomplete: Tranche ${t.label} final size is still Open` });
    for (const [p, l] of [['IssuanceDataGroup/Issuance/IssuePrice/Value', 'issue price'], ['IssuanceDataGroup/Issuance/ReofferYield/Value', 're-offer yield'], ...(t.rateType === 'fixed' ? [['IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate', 'coupon']] : [])])
      if (notSet(pre + p)) out.push({ l: 'fail', src: 'bdt', t: `Pricing term sheet incomplete: Tranche ${t.label} ${l} is still ${m[pre + p]?.status === 'expected' ? 'Expected' : 'Open'}`, d: p });
  });
  if (notSet('IssuanceDataGroup/Issuance/TotalAggregateAmount/Value')) out.push({ l: 'fail', src: 'bdt', t: 'Pricing term sheet incomplete: total deal size is still Open' });
  if (new Set((ws?.tranches ?? []).map(t => t.currency)).size > 1 && notSet('x:usdEquivalent')) out.push({ l: 'fail', src: 'bdt', t: 'Pricing term sheet incomplete: USD-equivalent total is still Open' });
  return out;
}
/** Interim talk, size and skew stay Open with history until pricing. */
export const EVOLVING_FIELDS = ['x:iptSpread', 'x:guidance', 'x:bookSize', 'x:booksOpen', 'x:priceTalk', 'x:yieldTalk', 'x:sizeMsg', 'x:sizeIndication', 'x:sizeSkew'];
