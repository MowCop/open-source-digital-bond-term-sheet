import { describe, expect, it } from "vitest";
import { createMemoryHost, proposeThroughHost } from "./host";

describe("agent core runs on any host", () => {
  it("a proposal does not change the deal until a person approves it", async () => {
    const host = createMemoryHost({ currency: "USD" });
    const change = await proposeThroughHost(host, {
      field: "currency",
      before_value: "USD",
      after_value: "EUR",
      reason: "Page 1",
    });
    await host.proposeChange(change);
    expect((await host.readDeal()).deal.currency).toBe("USD");
    expect(await host.decideChange("1", true)).toBe("approved");
    expect((await host.readDeal()).deal.currency).toBe("EUR");
  });

  it("rejects approving a change whose original value is stale", async () => {
    const host = createMemoryHost({ currency: "USD" });
    await host.proposeChange({
      field: "currency",
      before_value: "GBP",
      after_value: "EUR",
      reason: "x",
    });
    await expect(host.decideChange("1", true)).rejects.toThrow("Deal changed");
  });

  it("a rejected change can't be decided again", async () => {
    const host = createMemoryHost({ currency: "USD" });
    await host.proposeChange({
      field: "currency",
      before_value: "USD",
      after_value: "EUR",
      reason: "x",
    });
    await host.decideChange("1", false);
    await expect(host.decideChange("1", true)).rejects.toThrow("already decided");
  });
});
