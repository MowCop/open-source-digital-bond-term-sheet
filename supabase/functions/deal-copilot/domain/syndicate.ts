import { z } from "npm:zod@3";
import { checkDeal, type Deal } from "./deal.ts";
import { buildDocumentReport, extractionSchema } from "./documents.ts";

export const syndicateSchema = extractionSchema
  .extend({
    risks: z.array(
      z.object({ field: z.string(), message: z.string(), quote: z.string() }).strict(),
    ),
  })
  .strict();
export type SyndicateOutput = z.infer<typeof syndicateSchema>;
export function buildSyndicateReport(output: SyndicateOutput, evidence: string, deal: Deal) {
  return {
    ...buildDocumentReport(output, evidence, deal),
    deterministic: checkDeal(deal).findings,
    risks: output.risks.filter((r) => r.quote.trim() && evidence.includes(r.quote)).slice(0, 20),
    scope: checkDeal(deal).scope,
  };
}
