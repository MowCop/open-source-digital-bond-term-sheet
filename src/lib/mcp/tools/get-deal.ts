import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const COLUMNS =
  "id, issuer_name, issuer_lei, currency, coupon, interest_type, stage, isin, cusip, common_code, benchmark, ipt, guidance, issue_price, reoffer_price, reoffer_spread, reoffer_yield, issue_date, pricing_date, settlement_date, maturity_date, day_count_fraction, governing_law, listing_venue, issuer_rating, bookrunners";

export default defineTool({
  name: "get_deal",
  title: "Get deal terms",
  description: "Get the key term-sheet fields for one deal the signed-in user can see.",
  inputSchema: { id: z.string().uuid().describe("Deal id from list_deals.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("deals").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Deal not found or not visible to you." }], isError: true };
    const deal: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      deal[k] = v == null ? null : typeof v === "string" ? v : JSON.stringify(v);
    }
    return { content: [{ type: "text", text: JSON.stringify(deal) }], structuredContent: { deal } };
  },
});
