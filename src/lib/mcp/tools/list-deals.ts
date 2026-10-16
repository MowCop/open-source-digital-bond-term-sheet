import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_deals",
  title: "List deals",
  description: "List bond deals the signed-in user can see, optionally filtered by issuer name.",
  inputSchema: {
    issuer: z.string().max(200).optional().describe("Part of the issuer name to filter by."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum rows (default 50)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ issuer, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("deals")
      .select("id, issuer_name, currency, coupon, stage, isin, maturity_date, pricing_date, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (issuer) q = q.ilike("issuer_name", `%${issuer}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((d) => ({
      id: String(d.id), issuer_name: String(d.issuer_name ?? ""), currency: String(d.currency ?? ""),
      coupon: String(d.coupon ?? ""), stage: String(d.stage ?? ""), isin: d.isin ? String(d.isin) : null,
      maturity_date: d.maturity_date ? String(d.maturity_date) : null,
      pricing_date: d.pricing_date ? String(d.pricing_date) : null,
    }));
    return { content: [{ type: "text", text: JSON.stringify(rows) }], structuredContent: { deals: rows } };
  },
});
