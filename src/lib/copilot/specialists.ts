import { z } from "zod";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  isWeekend,
  parseISO,
} from "date-fns";
import { extractionSchema } from "./documents";
import type { Deal } from "./deal";

export const specialistIds = [
  "compliance",
  "pricing",
  "esg",
  "communications",
] as const;
export type SpecialistId = (typeof specialistIds)[number];
export const specialistNames: Record<SpecialistId, string> = {
  compliance: "Compliance & Regulatory",
  pricing: "Pricing & Benchmark",
  esg: "ESG & Sustainable Finance",
  communications: "Syndicate Communications",
};
export const specialistSchema = extractionSchema
  .extend({
    findings: z.array(
      z
        .object({ topic: z.string(), message: z.string(), quote: z.string() })
        .strict(),
    ),
    missingEvidence: z.array(z.string()),
    bulletin: z.string(),
    announcement: z.string(),
  })
  .strict();
export type SpecialistOutput = z.infer<typeof specialistSchema>;
export type SpecialistReport = SpecialistOutput & {
  id: SpecialistId;
  reviewedAt: string;
  xmlDraft: string;
};

export function normalizeSpecialist(
  id: SpecialistId,
  output: SpecialistOutput,
  evidence: string,
  deal: Deal,
): SpecialistReport {
  if (!output.summary.trim())
    throw new Error(`${specialistNames[id]} returned no usable review.`);
  return {
    ...output,
    summary: output.summary.slice(0, 4000),
    terms: output.terms
      .slice(0, 30)
      .filter((t) => t.quote.trim() && evidence.includes(t.quote)),
    findings: output.findings
      .filter((f) => f.quote.trim() && evidence.includes(f.quote))
      .slice(0, 20),
    missingEvidence: output.missingEvidence.slice(0, 20),
    warnings: [
      ...output.warnings.slice(0, 20),
      "Evidence review only; no external registry, legal, market or distribution verification.",
    ],
    bulletin: id === "communications" ? output.bulletin.slice(0, 12000) : "",
    announcement:
      id === "communications" ? output.announcement.slice(0, 12000) : "",
    id,
    reviewedAt: new Date().toISOString(),
    xmlDraft: id === "communications" ? buildCommunicationXml(deal) : "",
  };
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
/** Portable draft only: never claim BDT conformance without an agreed XSD. */
export function buildCommunicationXml(deal: Deal) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<DealAnnouncement status="draft" validation="not-BDT-validated">\n' +
    Object.entries(deal)
      .filter(([key]) => key !== "sourceText")
      .map(([key, value]) => `  <${key}>${xmlEscape(value)}</${key}>`)
      .join("\n") +
    "\n</DealAnnouncement>"
  );
}

function validDate(value: string) {
  const date = parseISO(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !isValid(date) ||
    format(date, "yyyy-MM-dd") !== value
  )
    throw new Error("Use valid YYYY-MM-DD dates.");
  return date;
}
export function calculateAccrual(input: {
  start: string;
  end: string;
  convention: string;
  principal: number;
  annualRatePercent: number;
}) {
  const days = differenceInCalendarDays(
    validDate(input.end),
    validDate(input.start),
  );
  if (
    days < 0 ||
    !Number.isFinite(input.principal) ||
    input.principal < 0 ||
    !Number.isFinite(input.annualRatePercent)
  )
    throw new Error("Invalid accrual inputs.");
  const denominator =
    input.convention === "ACT/360"
      ? 360
      : input.convention === "ACT/365F"
        ? 365
        : 0;
  if (!denominator) throw new Error("Only ACT/360 and ACT/365F are supported.");
  return {
    days,
    yearFraction: days / denominator,
    interest:
      (((input.principal * input.annualRatePercent) / 100) * days) /
      denominator,
    convention: input.convention,
  };
}
export function calculateSettlement(input: {
  tradeDate: string;
  lag: number;
  holidays: string[];
}) {
  if (input.lag !== 1 && input.lag !== 2)
    throw new Error("Settlement lag must be T+1 or T+2.");
  const holidays = new Set(
    input.holidays.map((value) => format(validDate(value), "yyyy-MM-dd")),
  );
  let date = validDate(input.tradeDate);
  let days = 0;
  for (let examined = 0; days < input.lag; examined++) {
    if (examined > 370)
      throw new Error("Holiday calendar contains no usable settlement days.");
    date = addDays(date, 1);
    if (!isWeekend(date) && !holidays.has(format(date, "yyyy-MM-dd"))) days++;
  }
  return {
    settlementDate: format(date, "yyyy-MM-dd"),
    scope:
      "Saturday/Sunday weekends and supplied holidays only; confirm the applicable market calendar.",
  };
}
