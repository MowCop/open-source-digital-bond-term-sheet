export const dealFields = [
  "issuer",
  "currency",
  "size",
  "coupon",
  "maturity",
  "isin",
  "governingLaw",
  "sourceText",
] as const;
export type DealField = (typeof dealFields)[number];
export type Deal = Record<DealField, string>;
export const blankDeal: Deal = {
  issuer: "",
  currency: "",
  size: "",
  coupon: "",
  maturity: "",
  isin: "",
  governingLaw: "",
  sourceText: "",
};
export function asDeal(value: unknown): Deal {
  const object =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    dealFields.map((field) => [
      field,
      typeof object[field] === "string" ? object[field] : "",
    ]),
  ) as Deal;
}
export function validIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const expanded = [...isin]
    .map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c))
    .join("");
  let sum = 0;
  [...expanded].reverse().forEach((c, i) => {
    const n = Number(c) * (i % 2 === 1 ? 2 : 1);
    sum += n > 9 ? n - 9 : n;
  });
  return sum % 10 === 0;
}
export function checkDeal(deal: Deal) {
  const findings: {
    field: string;
    severity: "warning" | "error";
    message: string;
  }[] = [];
  for (const field of [
    "issuer",
    "currency",
    "size",
    "coupon",
    "maturity",
  ] as const) {
    if (!deal[field].trim())
      findings.push({
        field,
        severity: "warning",
        message: "Required deal context is missing.",
      });
  }
  if (deal.currency && !/^[A-Z]{3}$/.test(deal.currency))
    findings.push({
      field: "currency",
      severity: "error",
      message:
        "Currency must be a three-letter uppercase code; registry validity is not verified.",
    });
  if (deal.isin && !validIsin(deal.isin))
    findings.push({
      field: "isin",
      severity: "error",
      message: "ISIN format or check digit is invalid.",
    });
  if (
    deal.maturity &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(deal.maturity) ||
      Number.isNaN(Date.parse(deal.maturity)) ||
      new Date(deal.maturity).toISOString().slice(0, 10) !== deal.maturity)
  )
    findings.push({
      field: "maturity",
      severity: "error",
      message: "Maturity must be a valid YYYY-MM-DD date.",
    });
  return {
    findings,
    scope:
      "Completeness, currency format, ISIN checksum, maturity date. No external registry, legal, ICMA or market verification.",
  };
}
export function validateProposal(
  deal: Deal,
  field: string,
  before: string,
  after: string,
) {
  if (!dealFields.includes(field as DealField) || field === "sourceText")
    throw new Error("This field cannot be changed by the agent.");
  if (deal[field as DealField] !== before)
    throw new Error("Deal changed; refresh the proposal.");
  if (!after.trim() || after.length > 2000)
    throw new Error(
      "A proposed value must be nonempty and within 2000 characters.",
    );
  return { field, before_value: before, after_value: after };
}
