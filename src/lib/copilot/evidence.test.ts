import { describe, it, expect } from "vitest";
import { trancheEvidence } from "./evidence";
describe("Tranche evidence", () => {
  it("withholds the programme ceiling as a bond size correction", () => {
    const out = trancheEvidence({
      summary: "Programme supplement",
      warnings: [],
      terms: [
        {
          field: "size",
          value: "10000000000",
          quote: "U.S.$10,000,000,000 Trust Certificate Issuance Programme",
          location: "Page 1",
        },
      ],
    });
    expect(out.terms).toHaveLength(0);
  });
  it("retains explicitly sourced tranche size", () => {
    const out = trancheEvidence({
      summary: "Pricing",
      warnings: [],
      terms: [
        {
          field: "size",
          value: "600000000",
          quote: "Issue amount: U.S.$600,000,000",
          location: "Pricing terms",
        },
      ],
    });
    expect(out.terms[0]?.value).toBe("600000000");
  });
});
