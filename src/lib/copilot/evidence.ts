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
    terms: terms.map(t => {
      if (t.field !== 'coupon') return t;
      const match = t.value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*%(?:\s*(?:per annum|p\.?a\.?))?$/i);
      return match ? { ...t, value: match[1] } : t;
    }),
    warnings:
      terms.length === extraction.terms.length
        ? extraction.warnings
        : [
            ...extraction.warnings,
            "No size correction proposed from a programme ceiling; a tranche-specific source is required.",
          ],
  };
}
