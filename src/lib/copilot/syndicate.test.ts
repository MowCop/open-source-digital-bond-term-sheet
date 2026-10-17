import { describe, it, expect } from "vitest";
import { blankDeal } from "./deal";
import { buildSyndicateReport } from "./syndicate";
describe("Autonomous syndicate proposals", () => {
  it("flags saved-term risks without requiring approval to review", () => {
    const report = buildSyndicateReport(
      { summary: "Review", terms: [], warnings: [], risks: [] },
      "",
      blankDeal,
    );
    expect(report.deterministic.some((r) => r.field === "issuer")).toBe(true);
  });
  it("automatically proposes evidenced corrections without applying them", () => {
    const deal = { ...blankDeal, currency: "USD" };
    const report = buildSyndicateReport(
      {
        summary: "Review",
        terms: [
          {
            field: "currency",
            value: "EUR",
            quote: "Currency: EUR",
            location: "Source",
          },
        ],
        warnings: [],
        risks: [],
      },
      "Currency: EUR",
      deal,
    );
    expect(report.differences[0]).toMatchObject({
      before: "USD",
      after: "EUR",
    });
    expect(deal.currency).toBe("USD");
  });
  it("withholds unsupported AI risk evidence", () => {
    const report = buildSyndicateReport(
      {
        summary: "Review",
        terms: [],
        warnings: [],
        risks: [{ field: "coupon", message: "Conflict", quote: "Coupon: 9%" }],
      },
      "Coupon: 4%",
      blankDeal,
    );
    expect(report.risks).toHaveLength(0);
  });
});
