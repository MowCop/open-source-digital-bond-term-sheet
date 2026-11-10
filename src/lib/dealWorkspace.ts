/**
 * Versioned multi-tranche deal workspace (foundation, step 1 of the
 * multi-tranche DTS plan). Pure logic only — no UI, no database.
 *
 * - Legal amounts stay per currency; unlike currencies are never summed.
 * - The USD equivalent is indicative display metadata with a recorded FX
 *   rate, source and date; it never replaces legal BDT amounts.
 */
import type { BdtState } from "./bdt-bridge";

export type RateType = "fixed" | "floating";

export interface Tranche {
  id: string;
  label: string;
  rateType: RateType;
  currency: string;
  /** Amount in tranche currency, as a plain number; null = not yet determined. */
  amount: number | null;
  tenor?: string;
  values: Record<string, unknown>;
}

export interface FxRate {
  /** Units of USD per 1 unit of currency. */
  usdPerUnit: number;
  source: string;
  asOf: string; // ISO date/time
  locked?: boolean;
}

export interface DealWorkspace {
  version: 1;
  shared: Record<string, unknown>;
  tranches: Tranche[];
  /** Planned totals per currency; null = not yet determined. */
  plannedTotals: Record<string, number | null>;
  fx: Record<string, FxRate>;
}

let seq = 0;
export const newTrancheId = () =>
  `tr_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Lossless adapter: legacy single-product BDT state → one-tranche workspace. */
export function fromLegacy(state: BdtState | null | undefined, currency = "", amount: number | null = null): DealWorkspace {
  return {
    version: 1,
    shared: {},
    tranches: [
      { id: "tr_legacy", label: "A", rateType: "fixed", currency, amount, values: { ...(state ?? {}) } as Record<string, unknown> },
    ],
    plannedTotals: currency ? { [currency]: amount } : {},
    fx: {},
  };
}

/** Duplicate commercial terms but never unique security identifiers. */
const UNIQUE_ID_KEYS = /isin|cusip|figi|common.?code|wkn|sedol/i;
export function duplicateTranche(t: Tranche, label: string): Tranche {
  const values = Object.fromEntries(Object.entries(t.values).filter(([k]) => !UNIQUE_ID_KEYS.test(k)));
  return { ...t, id: newTrancheId(), label, values };
}

/** Sum tranche amounts per currency. Unknown amounts are not treated as zero. */
export function totalsByCurrency(ws: DealWorkspace): Record<string, { sum: number; unknown: number }> {
  const out: Record<string, { sum: number; unknown: number }> = {};
  for (const t of ws.tranches) {
    if (!t.currency) continue;
    const e = (out[t.currency] ??= { sum: 0, unknown: 0 });
    if (t.amount == null) e.unknown++;
    else e.sum += t.amount;
  }
  return out;
}

export type Reconciliation = { currency: string; status: "match" | "mismatch" | "incomplete" | "no_plan"; planned: number | null; tranches: number };

export function reconcile(ws: DealWorkspace): Reconciliation[] {
  const totals = totalsByCurrency(ws);
  const ccys = new Set([...Object.keys(totals), ...Object.keys(ws.plannedTotals)]);
  return [...ccys].map((c) => {
    const planned = ws.plannedTotals[c] ?? null;
    const t = totals[c] ?? { sum: 0, unknown: 0 };
    let status: Reconciliation["status"];
    if (planned == null) status = "no_plan";
    else if (t.unknown > 0) status = "incomplete";
    else status = Math.abs(t.sum - planned) < 1e-6 ? "match" : "mismatch";
    return { currency: c, status, planned, tranches: t.sum };
  });
}

export interface UsdEquivalent {
  total: number | null;
  perTranche: Record<string, number | null>;
  missingRates: string[];
  indicative: true;
}

/** Indicative USD equivalent. USD needs no conversion; missing rates yield null, never a guess. */
export function usdEquivalent(ws: DealWorkspace): UsdEquivalent {
  const perTranche: Record<string, number | null> = {};
  const missing = new Set<string>();
  let total: number | null = 0;
  for (const t of ws.tranches) {
    let v: number | null = null;
    if (t.amount != null && t.currency) {
      if (t.currency === "USD") v = t.amount;
      else if (ws.fx[t.currency]) v = t.amount * ws.fx[t.currency].usdPerUnit;
      else missing.add(t.currency);
    }
    perTranche[t.id] = v;
    if (v == null) total = null;
    else if (total != null) total += v;
  }
  return { total, perTranche, missingRates: [...missing], indicative: true };
}

/** Warn when a multi-currency deal has missing or stale (> maxAgeDays) unlocked FX rates. */
export function fxWarnings(ws: DealWorkspace, now = new Date(), maxAgeDays = 3): string[] {
  const ccys = new Set(ws.tranches.map((t) => t.currency).filter(Boolean));
  if (ccys.size < 2) return [];
  const w: string[] = [];
  for (const c of ccys) {
    if (c === "USD") continue;
    const r = ws.fx[c];
    if (!r) { w.push(`No FX rate for ${c}: USD equivalent unavailable`); continue; }
    const age = (now.getTime() - new Date(r.asOf).getTime()) / 86_400_000;
    if (!r.locked && age > maxAgeDays) w.push(`FX rate for ${c} is stale (${r.asOf}, ${r.source})`);
  }
  return w;
}
