/* Validation. `checks(state)` returns [{l:"pass"|"warn"|"fail", t, d}].
   A "fail" blocks release. These are the compliance and consistency rules a desk would otherwise carry in its head. */
import { FIELDS, STAGES } from "./fields.js";
import { filled } from "./model.js";

const stageName = i => `${i}. ${STAGES[i - 1].t}`;

export function validLEI(s) {
  if (!/^[A-Z0-9]{20}$/.test(s)) return false;
  const n = s.split("").map(c => (/[0-9]/.test(c) ? c : (c.charCodeAt(0) - 55))).join("");
  let r = 0; for (const ch of n) r = (r * 10 + Number(ch)) % 97;
  return r === 1;
}

export function validISIN(s) {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s)) return false;
  const d = s.slice(0, 11).split("").map(c => (/[0-9]/.test(c) ? c : String(c.charCodeAt(0) - 55))).join("");
  let sum = 0, dbl = true;
  for (let i = d.length - 1; i >= 0; i--) { let x = Number(d[i]); if (dbl) { x *= 2; if (x > 9) x -= 9; } sum += x; dbl = !dbl; }
  return (10 - (sum % 10)) % 10 === Number(s[11]);
}

export function fieldError(state, fd) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const val = String(v(fd.p)).trim(); if (!val) return null;
  if (fd.cur && !/^[A-Z]{3}$/.test(val)) return "Three-letter ISO currency code";
  if (fd.p.endsWith("GoverningLaw/CountryCode") && !/^[A-Z]{2}$/.test(val)) return "Two-letter ISO country code";
  return null;
}

export function checks(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const out = [];
  const S = state.stage;
  const missing = FIELDS.filter(x => x.req && x.req <= S && !filled(state, x));
  out.push(missing.length
    ? { l: "fail", t: `${missing.length} required fields are empty`, d: missing.slice(0, 6).map(x => x.l).join("; ") + (missing.length > 6 ? "…" : "") }
    : { l: "pass", t: "All fields required at this stage are populated", d: stageName(S) });

  const roles = state.parties.flatMap(p => p.Roles || []);
  out.push(roles.includes("ISSUER") ? { l: "pass", t: "Issuer identified" } : { l: "fail", t: "No party carries the ISSUER role" });
  const mgr = state.parties.filter(p => (p.Roles || []).some(r => /MANAGER|BOOKRUNNER|COORDINATOR|ARRANGER/.test(r)));
  if (v("IssuanceDataGroup/Issuance/MethodOfDistribution/DistributionMethod") === "SYNDICATED")
    out.push(mgr.length >= 2 ? { l: "pass", t: `${mgr.length} managers named` } : { l: "warn", t: "Syndicated distribution with fewer than two managers named" });
  const badLEI = state.parties.filter(p => p.LEIIdentifier && !validLEI(p.LEIIdentifier));
  if (badLEI.length) out.push({ l: "fail", t: "Invalid LEI", d: badLEI.map(p => p.PartyName || "unnamed").join("; ") });
  const noLEI = state.parties.filter(p => !p.LEIIdentifier);
  if (noLEI.length) out.push({ l: "warn", t: `${noLEI.length} parties without an LEI`, d: "Reference data consumers and ESMA FIRDS reporting need the issuer LEI at the latest by pricing." });

  const pd = v("IssuanceDataGroup/Issuance/PricingDate"), idt = v("IssuanceDataGroup/Issuance/IssueDate"),
    sd = v("IssuanceDataGroup/Issuance/SettlementDate"), md = v("IssuanceDataGroup/Product/Maturity/MaturityDate");
  if (pd && idt) out.push(pd <= idt ? { l: "pass", t: "Pricing date on or before issue date" } : { l: "fail", t: "Pricing date is after the issue date" });
  if (idt && sd) out.push(idt <= sd ? { l: "pass", t: "Issue date on or before settlement date" } : { l: "fail", t: "Issue date is after the settlement date" });
  if (sd && md) out.push(md > sd ? { l: "pass", t: "Maturity after settlement" } : { l: "fail", t: "Maturity date is not after settlement" });
  const frd = v("IssuanceDataGroup/Issuance/Redemption/FinalRedemptionDate");
  if (frd && md && frd !== md) out.push({ l: "warn", t: "Final redemption date differs from the maturity date", d: "Intentional for some structures, but unusual on a vanilla bond." });

  const ids = state.ids || [];
  const isin = ids.find(x => x.Type === "ISIN");
  if (S >= 5) out.push(isin && validISIN(isin.Value) ? { l: "pass", t: "Valid ISIN present" } : { l: "fail", t: "No valid ISIN", d: "Use TEMPORARY_ISIN before the code is confirmed." });
  if (S >= 5 && !ids.find(x => x.Type === "COMMON_CODE")) out.push({ l: "warn", t: "No common code", d: "ICSD-cleared issues normally carry one." });

  const tefra = v("IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraCode");
  const gnt = v("IssuanceDataGroup/Product/InitialFormOfNote/GlobalNote/GlobalNoteType");
  if (tefra === "TEFRA_D") {
    out.push(gnt === "TEMPORARY" ? { l: "pass", t: "TEFRA D consistent with a temporary global note" } : { l: "fail", t: "TEFRA D without a temporary global note", d: "TEFRA D requires a temporary global note exchangeable after the 40-day distribution compliance period." });
    if (!has("IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraExchangeDate")) out.push({ l: "warn", t: "TEFRA D exchange date missing" });
  }
  if (tefra === "TEFRA_C" && gnt === "TEMPORARY") out.push({ l: "warn", t: "TEFRA C with a temporary global note", d: "TEFRA C issues are normally in permanent global form from the outset." });

  const tm = v("IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType");
  const priips = v("IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction");
  const cci = v("IssuanceDataGroup/Issuance/SellingRestrictions/CCIRestriction");
  if (tm && /PROF_AND_ECPS$/.test(tm) && priips && !/^NO_/.test(priips))
    out.push({ l: "warn", t: "Professional-only target market without a retail prohibition legend", d: "Wholesale deals normally pair the professionals and ECPs target market with NO_EEA or NO_UK." });
  if (tm && /UK_/.test(tm) && !cci) out.push({ l: "warn", t: "UK target market with no CCI determination", d: "The UK CCI regime replaced UK PRIIPs on 6 April 2026." });
  if (priips && cci) out.push({ l: "pass", t: "Retail distribution legends set for both EEA and UK" });

  const listed = v("IssuanceDataGroup/Issuance/Listing/Listed");
  if (listed === "true") {
    out.push(has("IssuanceDataGroup/Issuance/Listing/ListingVenue/Market") ? { l: "pass", t: "Listing venue named" } : { l: S >= 4 ? "fail" : "warn", t: "Listed but no venue named" });
    if (!roles.includes("LISTING_AGENT")) out.push({ l: "warn", t: "No listing agent among the parties" });
  }
  if (v("x:stabilisation") === "APPLICABLE" && !roles.includes("STABILISATION_MANAGER"))
    out.push({ l: "fail", t: "Stabilisation applicable but no stabilisation manager named", d: "The manager must be identified in the pre-stabilisation notice." });

  const cpn = Number(v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate"));
  const yld = Number(v("IssuanceDataGroup/Issuance/IndicationOfYield/Value"));
  const px = Number(v("IssuanceDataGroup/Issuance/IssuePrice/Value"));
  if (cpn && yld && px) {
    const dir = (px < 100 && yld > cpn) || (px > 100 && yld < cpn) || (Math.abs(px - 100) < 0.01 && Math.abs(yld - cpn) < 0.02);
    out.push(dir ? { l: "pass", t: "Price, coupon and yield are directionally consistent" } : { l: "fail", t: "Price, coupon and yield disagree", d: "A discount price should give a yield above the coupon, and a premium price a yield below it." });
  }
  const tot = Number(v("IssuanceDataGroup/Issuance/TotalAggregateAmount/Value"));
  const agg = Number(v("IssuanceDataGroup/Product/AggregateNominalAmount/Value"));
  if (tot && agg) out.push(tot === agg ? { l: "pass", t: "Issuance and product amounts agree" } : { l: "fail", t: "Total aggregate amount and aggregate nominal amount differ" });
  const mx = Number(v("IssuanceDataGroup/Issuance/MaximumAmount/Value"));
  if (tot && mx && tot > mx) out.push({ l: "fail", t: "Final size exceeds the communicated maximum size" });
  const den = Number(v("IssuanceDataGroup/Issuance/SpecifiedDenomination/Value"));
  if (den && den < 100000 && tm && /PROF_AND_ECPS$/.test(tm))
    out.push({ l: "warn", t: "Denomination below 100,000 with a wholesale target market", d: "Retail denominations change the prospectus and key information document position." });
  if (agg && den && agg % den !== 0) out.push({ l: "warn", t: "Issue size is not a whole multiple of the denomination" });

  if (!state.docs.length) out.push({ l: "fail", t: "No deal documents attached" });
  else {
    const undated = state.docs.filter(d => !d.DocumentDate).length;
    if (undated) out.push({ l: "warn", t: `${undated} documents without a date`, d: "Every supplement on file should be cited with its date." });
    else out.push({ l: "pass", t: `${state.docs.length} deal documents cited` });
  }
  if (S >= 5 && v("IssuanceDataGroup/Product/InterestPayment/InterestType") !== "FIXED")
    out.push({ l: "warn", t: "This template iteration validates fixed rate single tranche issues only" });
  return out;
}

export function tally(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";
 const c = checks(state); return { fail: c.filter(x => x.l === "fail").length, warn: c.filter(x => x.l === "warn").length, pass: c.filter(x => x.l === "pass").length }; }