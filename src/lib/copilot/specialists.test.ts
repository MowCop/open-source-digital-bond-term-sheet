import { describe, expect, it } from "vitest";
import { asDeal } from "./deal";
import {
  buildCommunicationXml,
  calculateAccrual,
  calculateSettlement,
  normalizeSpecialist,
} from "./specialists";

describe("specialist safeguards", () => {
  it("counts leap-day accrual using calendar days", () => {
    expect(
      calculateAccrual({
        start: "2024-02-28",
        end: "2024-03-01",
        principal: 36500,
        annualRatePercent: 10,
        convention: "ACT/365F",
      }).interest,
    ).toBe(20);
  });
  it("distinguishes ACT/360 and ACT/365F", () => {
    const data = {
      start: "2026-01-01",
      end: "2026-01-31",
      principal: 1000000,
      annualRatePercent: 5,
    };
    expect(
      calculateAccrual({ ...data, convention: "ACT/360" }).interest,
    ).toBeCloseTo(4166.6666667);
    expect(
      calculateAccrual({ ...data, convention: "ACT/365F" }).interest,
    ).toBeCloseTo(4109.5890411);
  });
  it("computes T+1 with supplied holidays", () => {
    expect(
      calculateSettlement({
        tradeDate: "2026-10-16",
        lag: 1,
        holidays: ["2026-10-19"],
      }).settlementDate,
    ).toBe("2026-10-20");
  });
  it("computes T+2 separately", () => {
    expect(
      calculateSettlement({ tradeDate: "2026-10-16", lag: 2, holidays: [] })
        .settlementDate,
    ).toBe("2026-10-20");
  });
  it("rejects invented conventions and invalid dates", () => {
    expect(() =>
      calculateAccrual({
        start: "2026-02-30",
        end: "2026-03-01",
        principal: 1,
        annualRatePercent: 5,
        convention: "ACT/360",
      }),
    ).toThrow();
    expect(() =>
      calculateSettlement({ tradeDate: "2026-10-16", lag: 3, holidays: [] }),
    ).toThrow();
  });
  it("removes unsupported findings and leaves saved terms unchanged", () => {
    const deal = asDeal({ currency: "USD" });
    const report = normalizeSpecialist(
      "compliance",
      {
        summary: "Review",
        terms: [],
        warnings: [],
        missingEvidence: ["Current sanctions check"],
        findings: [
          { topic: "PRIIPs", message: "Review restriction", quote: "No retail sales" },
          { topic: "LEI", message: "Verified", quote: "Invented" },
        ],
        bulletin: "",
        announcement: "",
      },
      "No retail sales",
      deal,
    );
    expect(report.findings).toHaveLength(1);
    expect(report.missingEvidence).toEqual(["Current sanctions check"]);
    expect(deal.currency).toBe("USD");
  });
  it("produces escaped unvalidated XML drafts without source text", () => {
    const xml = buildCommunicationXml(
      asDeal({ issuer: 'A & <B> "C"', sourceText: "private evidence" }),
    );
    expect(xml).toContain("A &amp; &lt;B&gt; &quot;C&quot;");
    expect(xml).toContain('validation="not-BDT-validated"');
    expect(xml).not.toContain("private evidence");
  });
});
