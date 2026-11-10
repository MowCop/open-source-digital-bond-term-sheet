import { describe, it, expect } from "vitest";
import { aggregateUsdEquivalent, duplicateTranche, fromLegacy, fxWarnings, reconcile, usdEquivalent, type DealWorkspace } from "./dealWorkspace";

const ws = (): DealWorkspace => ({
  version: 1,
  shared: {},
  plannedTotals: { USD: 1000, EUR: 500 },
  fx: { EUR: { usdPerUnit: 1.1, source: "ECB", asOf: "2026-11-09" } },
  tranches: [
    { id: "a", label: "A", rateType: "fixed", currency: "USD", amount: 600, values: {} },
    { id: "b", label: "B", rateType: "floating", currency: "USD", amount: 400, values: {} },
    { id: "c", label: "C", rateType: "fixed", currency: "EUR", amount: 500, values: {} },
  ],
});

describe("dealWorkspace", () => {
  it("records an aggregate USD total before any tranche amounts are known", () => {
    const w = ws(); w.aggregateUsd = 2000000000;
    w.tranches.forEach(t => { t.amount = null; });
    expect(aggregateUsdEquivalent(w)).toBe(2000000000);
    expect(usdEquivalent(w).total).toBeNull();
    expect(w.tranches.map(t => t.amount)).toEqual([null, null, null]);
  });
  it("retains calculated USD equivalents when no aggregate is entered", () => {
    expect(aggregateUsdEquivalent(ws())).toBeCloseTo(1550);
  });
  it("reconciles totals per currency without mixing currencies", () => {
    expect(reconcile(ws()).map((r) => r.status)).toEqual(["match", "match"]);
  });
  it("treats unknown tranche amounts as incomplete, not zero", () => {
    const w = ws(); w.tranches[2].amount = null;
    expect(reconcile(w).find((r) => r.currency === "EUR")?.status).toBe("incomplete");
  });
  it("computes indicative USD equivalent using recorded FX", () => {
    const u = usdEquivalent(ws());
    expect(u.total).toBeCloseTo(1550);
    expect(u.perTranche.c).toBeCloseTo(550);
  });
  it("never guesses a USD equivalent when a rate is missing", () => {
    const w = ws(); w.fx = {};
    expect(usdEquivalent(w).total).toBeNull();
    expect(usdEquivalent(w).missingRates).toEqual(["EUR"]);
  });
  it("warns on stale unlocked FX for multi-currency deals", () => {
    expect(fxWarnings(ws(), new Date("2026-11-20"))).toHaveLength(1);
    const w = ws(); w.fx.EUR.locked = true;
    expect(fxWarnings(w, new Date("2026-11-20"))).toHaveLength(0);
  });
  it("duplication drops unique security identifiers", () => {
    const t = { ...ws().tranches[0], values: { isin: "XS123", coupon: "4" } };
    expect(duplicateTranche(t, "D").values).toEqual({ coupon: "4" });
  });
  it("adapts a legacy record to one tranche", () => {
    expect(fromLegacy({} as never, "USD", 500).tranches).toHaveLength(1);
  });
});
