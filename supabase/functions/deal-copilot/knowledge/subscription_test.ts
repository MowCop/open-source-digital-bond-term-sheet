import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { querySubscriptionSource, runKnowledgeTool } from "./tools.ts";
Deno.test("subscription source output is always marked demo", () => {
  const r = querySubscriptionSource({ provider: "Moodys", borrower: "Sasol" });
  assertEquals(r.demo, true);
  assertEquals(r.label, "Demo subscription data, illustrative only");
});
Deno.test("unknown subscription provider rejected", () => {
  assertThrows(() => querySubscriptionSource({ provider: "acme", borrower: "Sasol" }));
});
Deno.test("subscription tool reachable through runKnowledgeTool", async () => {
  const r: any = await runKnowledgeTool("querySubscriptionSource", { provider: "fitch", borrower: "X" });
  assertEquals(r.demo, true);
});
