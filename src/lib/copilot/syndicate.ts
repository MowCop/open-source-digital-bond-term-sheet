import { z } from "zod";
import { checkDeal, type Deal } from "./deal";
import { buildDocumentReport, extractionSchema } from "./documents";
import type { SpecialistReport } from "./specialists";

export const syndicateSchema = extractionSchema
  .extend({
    risks: z.array(
      z
        .object({ field: z.string(), message: z.string(), quote: z.string() })
        .strict(),
    ),
  })
  .strict();
export type SyndicateOutput = z.infer<typeof syndicateSchema>;
export function buildSyndicateReport(
  output: SyndicateOutput,
  evidence: string,
  deal: Deal,
  specialists: SpecialistReport[] = [],
) {
  const combined = {
    ...output,
    terms: [...output.terms, ...specialists.flatMap((s) => s.terms)],
  };
  return {
    ...buildDocumentReport(combined, evidence, deal),
    deterministic: checkDeal(deal).findings,
    risks: [
      ...output.risks,
      ...specialists.flatMap((s) =>
        s.findings.map((f) => ({
          field: f.topic,
          message: f.message,
          quote: f.quote,
        })),
      ),
    ]
      .filter((r) => r.quote.trim() && evidence.includes(r.quote))
      .slice(0, 20),
    specialists,
    reportVersion: 2,
    scope: checkDeal(deal).scope,
  };
}
