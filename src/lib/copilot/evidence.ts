import type { Extraction } from "./documents";
/** A programme ceiling is not the aggregate amount of this bond/tranche. */
export function trancheEvidence<T extends Extraction>(extraction: T): T {
  const terms = extraction.terms.filter(
    (t) =>
      t.field !== "size" ||
      !/programme|program\b|ceiling|maximum.*issuance/i.test(
        t.quote + " " + t.location,
      ),
  );
  return {
    ...extraction,
    terms,
    warnings:
      terms.length === extraction.terms.length
        ? extraction.warnings
        : [
            ...extraction.warnings,
            "No size correction proposed from a programme ceiling; a tranche-specific source is required.",
          ],
  };
}
