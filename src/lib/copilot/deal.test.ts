import { describe, expect, it } from "vitest";
import { blankDeal, validIsin, validateProposal } from "./deal";
describe("Deal corrections require review and current context", () => {
  it("rejects stale original values", () =>
    expect(() =>
      validateProposal({ ...blankDeal, currency: "EUR" }, "currency", "USD", "GBP"),
    ).toThrow("Deal changed"));
  it("forbids source changes by the agent", () =>
    expect(() => validateProposal(blankDeal, "sourceText", "", "replacement")).toThrow());
  it("returns a proposal without changing the deal", () => {
    const deal = { ...blankDeal, currency: "eur" };
    expect(validateProposal(deal, "currency", "eur", "EUR").after_value).toBe("EUR");
    expect(deal.currency).toBe("eur");
  });
  it("detects a known valid checksum", () => {
    expect(validIsin("US0378331005")).toBe(true);
    expect(validIsin("US0378331006")).toBe(false);
  });
});
