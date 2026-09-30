/* Human-readable renderings: the term sheet rows, its plain-text form, and the chat block. */
import { STAGES } from "./fields.js";

function fmtAmt(val, cur) {
  if (!val) return "";
  const n = Number(val);
  if (!isFinite(n)) return String(val);
  const s = n >= 1e9 ? (n / 1e9).toLocaleString("en-GB", { maximumFractionDigits: 3 }) + "bn"
    : n >= 1e6 ? (n / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 3 }) + "m"
      : n.toLocaleString("en-GB");
  return (cur ? cur + " " : "") + s;
}

export function sheetRows(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const cur = v("IssuanceDataGroup/Issuance/SpecifiedCurrency");
  const party = r => state.parties.filter(p => (p.Roles || []).includes(r)).map(p => p.PartyName).join(", ");
  const ratings = state.ratings.filter(r => r.RatingValue).map(r => `${r.RatingValue} (${r.RatingAgency}${r.RatingOutlook ? ", " + r.RatingOutlook.toLowerCase() : ""})`).join(" / ");
  const size = v("IssuanceDataGroup/Issuance/TotalAggregateAmount/Value")
    ? fmtAmt(v("IssuanceDataGroup/Issuance/TotalAggregateAmount/Value"), cur)
    : (v("x:sizeMsg") || (v("IssuanceDataGroup/Issuance/MaximumAmount/Value") ? fmtAmt(v("IssuanceDataGroup/Issuance/MaximumAmount/Value"), cur) + " maximum" : ""));
  const st = [v("IssuanceDataGroup/Product/StatusOfNote/Seniority"), v("IssuanceDataGroup/Product/StatusOfNote/Subordinated"), v("IssuanceDataGroup/Product/StatusOfNote/Secured"), v("IssuanceDataGroup/Product/StatusOfNote/Preferred")].filter(Boolean).join(", ").toLowerCase();
  const spread = v("x:spreadSet") || v("x:guidance") || v("x:iptSpread");
  const rows = [
    ["Issuer", party("ISSUER")],
    ["Guarantor", party("GUARANTOR")],
    ["Issuer ratings", state.parties.filter(p => (p.Roles || []).includes("ISSUER")).flatMap(p => (p.Ratings || [])).filter(r => r.RatingValue).map(r => `${r.RatingValue} (${r.RatingAgency})`).join(" / ")],
    ["Expected issue ratings", ratings],
    ["Status", st],
    ["Format", [v("IssuanceDataGroup/Issuance/IssuanceType"), v("IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode"), v("IssuanceDataGroup/Product/ESGLabel")].filter(Boolean).join(", ")],
    ["Size", size],
    ["Order book", v("x:bookSize")],
    ["Pricing date", v("IssuanceDataGroup/Issuance/PricingDate")],
    ["Settlement date", v("IssuanceDataGroup/Issuance/SettlementDate")],
    ["Maturity date", v("IssuanceDataGroup/Product/Maturity/MaturityDate")],
    ["Coupon", v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate") ? v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate") + " per cent., " + (v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/InterestPaymentFrequency") || "").toLowerCase() : ""],
    ["Spread", spread],
    ["Reoffer spread to mid-swaps", v("IssuanceDataGroup/Issuance/ReofferSpreadtoMidSwapRate/Value") ? "+" + v("IssuanceDataGroup/Issuance/ReofferSpreadtoMidSwapRate/Value") + "bp" : ""],
    ["Benchmark", [v("IssuanceDataGroup/Issuance/Benchmark/Ticker/Ticker"), v("IssuanceDataGroup/Issuance/ReofferSpreadToBenchmark/Value") ? "+" + v("IssuanceDataGroup/Issuance/ReofferSpreadToBenchmark/Value") + "bp" : ""].filter(Boolean).join(" ")],
    ["Reoffer price", v("IssuanceDataGroup/Issuance/IssuePrice/Value")],
    ["Reoffer yield", v("IssuanceDataGroup/Issuance/IndicationOfYield/Value") ? v("IssuanceDataGroup/Issuance/IndicationOfYield/Value") + " per cent." : ""],
    ["New issue concession", v("x:nic")],
    ["First coupon date", v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/FirstPayment/PaymentDate")],
    ["Day count", v("IssuanceDataGroup/Product/DayCountFraction")],
    ["Business day convention", v("IssuanceDataGroup/Product/BusinessDayConvention/BusinessDayAdjustment")],
    ["Denomination", fmtAmt(v("IssuanceDataGroup/Issuance/SpecifiedDenomination/Value"), cur)],
    ["Redemption", v("IssuanceDataGroup/Issuance/Redemption/FinalRedemptionPercentage") ? v("IssuanceDataGroup/Issuance/Redemption/FinalRedemptionPercentage") + " per cent. at maturity" : ""],
    ["Optionality", v("IssuanceDataGroup/Product/Optionality")],
    ["Use of proceeds", [v("IssuanceDataGroup/Issuance/Proceeds/UseOfProceeds/UseOfProceedsPrimaryCategory"), v("IssuanceDataGroup/Issuance/Proceeds/UseOfProceeds/UseOfProceedsSubCategory")].filter(Boolean).join(" / ")],
    ["Form of notes", [v("IssuanceDataGroup/Product/InitialFormOfNote/LegalTitleFormOfNote"), v("IssuanceDataGroup/Product/InitialFormOfNote/GlobalNote/GlobalNoteType"), v("IssuanceDataGroup/Product/SafeKeepingStructure")].filter(Boolean).join(", ")],
    ["Listing", v("IssuanceDataGroup/Issuance/Listing/Listed") === "true" ? [v("IssuanceDataGroup/Issuance/Listing/ListingVenue/Market"), v("IssuanceDataGroup/Issuance/Listing/ListingVenue/MarketType")].filter(Boolean).join(", ") : "Unlisted"],
    ["Clearing", v("IssuanceDataGroup/Issuance/SecuritiesClearingSystem/Code")],
    ["Governing law", v("IssuanceDataGroup/Issuance/GoverningLaw/CountryCode")],
    ["Selling restrictions", [v("IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode"), v("IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraCode"), v("IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction"), v("IssuanceDataGroup/Issuance/SellingRestrictions/CCIRestriction") ? "CCI " + v("IssuanceDataGroup/Issuance/SellingRestrictions/CCIRestriction") : ""].filter(Boolean).join(" · ")],
    ["Target market", v("IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType")],
    ["Stabilisation", [v("x:stabilisation"), v("x:overAllot")].filter(Boolean).join(", ")],
    ["Bookrunners", state.parties.filter(p => (p.Roles || []).some(r => /MANAGER|BOOKRUNNER|COORDINATOR/.test(r))).map(p => p.PartyName).join(", ")],
    ["Billing and delivery", party("BILLING_AND_DELIVERY_AGENT")],
    ["ISIN", (state.ids.find(x => x.Type === "ISIN") || state.ids.find(x => x.Type === "TEMPORARY_ISIN") || {}).Value || ""],
    ["Common code", (state.ids.find(x => x.Type === "COMMON_CODE") || {}).Value || ""],
    ["Documentation", state.docs.map(d => d.DocumentName + (d.DocumentDate ? " dated " + d.DocumentDate : "")).join("; ")],
    ["Timing", [v("x:booksOpen") ? "Books open " + v("x:booksOpen") : "", v("x:booksSubject") ? "books subject " + v("x:booksSubject") : ""].filter(Boolean).join(", ")],
    ["Syndicate contact", v("x:syndDesk")]
  ];
  return rows.filter(r => String(r[1]).trim() !== "");
}

export function sheetText(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const head = `${state.deal || "Untitled deal"}\n${STAGES[state.stage - 1].t} — version ${state.ver} — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC\n`;
  const body = sheetRows(state).map(([k, val]) => k.padEnd(30, " ") + String(val)).join("\n");
  return head + "\n" + body + "\n\nNot an offer to sell or a solicitation to buy. Distribution restricted as set out above.\nThe legal documentation prevails over this record. Released through the VDR by the bookrunners.\n";
}

export function ibText(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const r = sheetRows(state);
  const pick = k => (r.find(x => x[0] === k) || [, ""])[1];
  return [
    state.deal || "NEW ISSUE",
    STAGES[state.stage - 1].t.toUpperCase(),
    pick("Issuer") ? "ISSUER: " + pick("Issuer") : "",
    pick("Size") ? "SIZE: " + pick("Size") : "",
    pick("Maturity date") ? "MATURITY: " + pick("Maturity date") : "",
    pick("Spread") ? "SPREAD: " + pick("Spread") : "",
    pick("Coupon") ? "CPN: " + pick("Coupon") : "",
    pick("Reoffer price") ? "REOFFER: " + pick("Reoffer price") : "",
    pick("Reoffer yield") ? "YIELD: " + pick("Reoffer yield") : "",
    pick("Order book") ? "BOOKS: " + pick("Order book") : "",
    pick("Expected issue ratings") ? "RATINGS: " + pick("Expected issue ratings") : "",
    pick("Bookrunners") ? "JLMS: " + pick("Bookrunners") : "",
    pick("Target market") ? "TARGET MKT: " + pick("Target market") : "",
    pick("Selling restrictions") ? "RESTRICTIONS: " + pick("Selling restrictions") : "",
    pick("Syndicate contact") ? "CONTACT: " + pick("Syndicate contact") : "",
    "REF: " + v("DocumentInformation/DocumentId") + " v" + state.ver
  ].filter(Boolean).join("\n");
}