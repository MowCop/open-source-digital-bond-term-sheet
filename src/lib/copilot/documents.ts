import { z } from "zod";
import { dealFields, type Deal } from "./deal";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_TEXT = 60000;
export const termSchema = z
  .object({
    field: z.enum([
      "issuer",
      "currency",
      "size",
      "coupon",
      "maturity",
      "isin",
      "governingLaw",
    ]),
    value: z.string(),
    quote: z.string(),
    location: z.string(),
  })
  .strict();
export const extractionSchema = z
  .object({
    summary: z.string(),
    terms: z.array(termSchema),
    warnings: z.array(z.string()),
  })
  .strict();
export type Extraction = z.infer<typeof extractionSchema>;
export type DocumentReport = ReturnType<typeof buildDocumentReport> & {
  comparison?: { mode: "live"; termSheetUpdatedAt: string; comparedAt: string };
};
export function validateDocument(name: string, size: number, text?: string) {
  if (!/\.(pdf|docx|txt|md|csv)$/i.test(name))
    throw new Error("Choose a PDF, DOCX, TXT, MD or CSV document.");
  if (size <= 0 || size > MAX_DOCUMENT_BYTES)
    throw new Error("Documents must be nonempty and at most 10 MB.");
  if (text !== undefined && (!text.trim() || text.length > MAX_DOCUMENT_TEXT))
    throw new Error(
      "Document text must be readable and within 60,000 characters. Split large documents before uploading.",
    );
}
export function buildDocumentReport(
  extraction: Extraction,
  text: string,
  baseline: Deal,
  previous?: Extraction,
) {
  const counts = new Map<string, Set<string>>();
  for (const term of extraction.terms) {
    const values = counts.get(term.field) ?? new Set<string>();
    values.add(term.value.trim());
    counts.set(term.field, values);
  }
  const warnings = [...extraction.warnings.slice(0, 20)];
  const terms = extraction.terms.filter((term, index, all) => {
    const valid =
      dealFields.includes(term.field) &&
      term.value.trim().length > 0 &&
      term.value.length <= 2000 &&
      term.quote.trim().length > 0 &&
      text.includes(term.quote) &&
      counts.get(term.field)?.size === 1;
    if (!valid)
      warnings.push(
        `No correction proposed for ${term.field}: ambiguous or unsupported evidence.`,
      );
    return valid && all.findIndex((t) => t.field === term.field) === index;
  });
  const differences = terms
    .filter((t) => t.value !== baseline[t.field])
    .map((t) => ({ ...t, before: baseline[t.field], after: t.value }));
  const versionDifferences = previous
    ? terms.flatMap((t) => {
        const old = previous.terms.find((p) => p.field === t.field);
        return old && old.value !== t.value
          ? [{ ...t, before: old.value, after: t.value }]
          : [];
      })
    : [];
  const missing = dealFields.filter(
    (field) => field !== "sourceText" && !terms.some((t) => t.field === field),
  );
  return {
    summary: extraction.summary.slice(0, 4000),
    terms,
    differences,
    versionDifferences,
    missing,
    warnings: [...new Set(warnings)],
  };
}
