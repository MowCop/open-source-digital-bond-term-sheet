import { describe, it, expect } from "vitest";
import { blankDeal } from "./deal";
import { buildDocumentReport, validateDocument } from "./documents";
describe("Document evidence review", () => {
  it("produces a reviewable diff without changing saved terms", () => {
    const baseline = { ...blankDeal, currency: "USD" };
    const report = buildDocumentReport(
      {
        summary: "Review",
        warnings: [],
        terms: [
          {
            field: "currency",
            value: "EUR",
            quote: "Currency: EUR",
            location: "Page 1",
          },
        ],
      },
      "Currency: EUR",
      baseline,
    );
    expect(report.differences[0]).toMatchObject({
      before: "USD",
      after: "EUR",
    });
    expect(baseline.currency).toBe("USD");
  });
  it("withholds invented source quotations", () => {
    const report = buildDocumentReport(
      {
        summary: "Review",
        warnings: [],
        terms: [
          {
            field: "currency",
            value: "EUR",
            quote: "Currency: EUR",
            location: "Page 1",
          },
        ],
      },
      "Currency: USD",
      blankDeal,
    );
    expect(report.differences).toHaveLength(0);
  });
  it("withholds conflicting commercial terms", () => {
    const report = buildDocumentReport(
      {
        summary: "Review",
        warnings: [],
        terms: ["4%", "5%"].map((value) => ({
          field: "coupon" as const,
          value,
          quote: `Coupon ${value}`,
          location: "Page 1",
        })),
      },
      "Coupon 4% Coupon 5%",
      blankDeal,
    );
    expect(report.differences).toHaveLength(0);
  });
  it("compares previous document terms separately from deal terms", () => {
    const term = {
      field: "currency" as const,
      value: "EUR",
      quote: "EUR",
      location: "Page 1",
    };
    const report = buildDocumentReport(
      { summary: "New", warnings: [], terms: [term] },
      "EUR",
      { ...blankDeal, currency: "EUR" },
      {
        summary: "Old",
        warnings: [],
        terms: [{ ...term, value: "USD", quote: "USD" }],
      },
    );
    expect(report.differences).toHaveLength(0);
    expect(report.versionDifferences[0]).toMatchObject({
      before: "USD",
      after: "EUR",
    });
  });
  it("rejects unreadable documents", () => {
    expect(() => validateDocument("scan.pdf", 100, "")).toThrow();
  });
  it("compares PDF terms to the current term sheet rather than the upload snapshot", () => {
    const uploadedSnapshot = { ...blankDeal, currency: "USD" };
    const liveTermSheet = { ...uploadedSnapshot, currency: "GBP" };
    const report = buildDocumentReport(
      {
        summary: "PDF terms",
        warnings: [],
        terms: [
          {
            field: "currency",
            value: "EUR",
            quote: "Currency: EUR",
            location: "Page 1",
          },
        ],
      },
      "Currency: EUR",
      liveTermSheet,
    );
    expect(report.differences[0]).toMatchObject({
      before: "GBP",
      after: "EUR",
    });
    expect(liveTermSheet.currency).toBe("GBP");
  });
  it("does not propose a correction when the live term sheet already matches the PDF", () => {
    const report = buildDocumentReport(
      {
        summary: "PDF terms",
        warnings: [],
        terms: [
          {
            field: "coupon",
            value: "4.25%",
            quote: "Coupon: 4.25%",
            location: "Page 1",
          },
        ],
      },
      "Coupon: 4.25%",
      { ...blankDeal, coupon: "4.25%" },
    );
    expect(report.terms[0]?.value).toBe("4.25%");
    expect(report.differences).toHaveLength(0);
  });
});
