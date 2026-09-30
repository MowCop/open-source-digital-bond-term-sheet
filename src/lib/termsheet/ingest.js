/* Assisted fill. Pure: nothing here mutates state. Each function returns proposals
   that the interface presents for human acceptance. That review step is deliberate — never auto-apply. */
import { FIELDS, GROUPS } from "./fields.js";
import { validISIN, validLEI } from "./validate.js";

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const LAWS = [[/english law|laws of england/i, "GB"], [/new york law/i, "US"], [/german law/i, "DE"], [/french law/i, "FR"], [/dutch law|laws of the netherlands/i, "NL"], [/luxembourg law/i, "LU"], [/irish law/i, "IE"]];

const VENUES = [[/luxembourg/i, "LUXEMBOURG_STOCK_EXCHANGE"], [/london stock exchange/i, "LONDON_STOCK_EXCHANGE"], [/euronext dublin|irish stock exchange/i, "EURONEXT_DUBLIN"], [/frankfurt/i, "FRANKFURT_STOCK_EXCHANGE"], [/six swiss/i, "SIX_SWISS_EXCHANGE"], [/singapore/i, "SINGAPORE_SGX"], [/nasdaq dubai/i, "NASDAQ_DUBAI"], [/vienna/i, "VIENNA_STOCK_EXCHANGE"]];

const RULES = [
  { p: "IssuanceDataGroup/Issuance/SpecifiedCurrency", l: "Specified currency", fn: t => { const m = t.match(/\b(EUR|USD|GBP|CHF|JPY|SEK|NOK|DKK|AUD|CAD|SGD|HKD|CNH|AED|SAR)\b/); if (m) return m[1]; const sym = t.match(/[\u20ac\u00a3\u0024]/); return sym ? ({ "\u20ac": "EUR", "\u00a3": "GBP", "$": "USD" })[sym[0]] : ""; } },
  {
    p: "IssuanceDataGroup/Issuance/TotalAggregateAmount/Value", l: "Total aggregate amount", fn: t => {
      const m = t.match(/(?:\b(?:EUR|USD|GBP|CHF|JPY|SEK|NOK|AUD|CAD|SGD|HKD|AED|SAR)|[\u20ac\u00a3\u0024])\s?([\d][\d,\.]*)\s?(billion|bn|million|mm|m)\b/i);
      if (m) return scaled(m[1], m[2]);
      const m2 = t.match(/\b(?:EUR|USD|GBP|CHF)\s?([\d]{1,3}(?:,\d{3}){2,})\b/); return m2 ? num(m2[1]) : "";
    }
  },
  { p: "IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate", l: "Coupon", fn: t => (t.match(/(?:coupon|rate of interest|interest rate)[^\d%]{0,40}(\d{1,2}[\.\u00b7]\d{1,4})\s*(?:per cent|%)/i) || t.match(/(\d{1,2}\.\d{2,4})\s*per cent\.?\s*(?:notes|fixed rate)/i) || [])[1] },
  { p: "IssuanceDataGroup/Issuance/IssuePrice/Value", l: "Issue price", fn: t => (t.match(/(?:issue price|re-?offer price)[^\d]{0,30}(\d{2,3}\.\d{1,4})/i) || [])[1] },
  { p: "IssuanceDataGroup/Issuance/IndicationOfYield/Value", l: "Indication of yield", fn: t => (t.match(/(?:yield|indication of yield)[^\d]{0,30}(\d{1,2}\.\d{1,4})\s*(?:per cent|%)/i) || [])[1] },
  { p: "IssuanceDataGroup/Product/Maturity/MaturityDate", l: "Maturity date", fn: t => toISO((t.match(/maturity date[:\s]{1,20}([^\n\.;]{6,30})/i) || t.match(/due\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i) || [])[1]) },
  { p: "IssuanceDataGroup/Issuance/IssueDate", l: "Issue date", fn: t => toISO((t.match(/issue date[:\s]{1,20}([^\n\.;]{6,30})/i) || [])[1]) },
  { p: "IssuanceDataGroup/Issuance/SettlementDate", l: "Settlement date", fn: t => toISO((t.match(/settlement date[:\s]{1,20}([^\n\.;]{6,30})/i) || [])[1]) },
  { p: "IssuanceDataGroup/Issuance/PricingDate", l: "Pricing date", fn: t => toISO((t.match(/(?:pricing|trade) date[:\s]{1,20}([^\n\.;]{6,30})/i) || [])[1]) },
  { p: "IssuanceDataGroup/Issuance/SpecifiedDenomination/Value", l: "Specified denomination", fn: t => { const m = t.match(/denominations?\s+of[^\d]{0,20}([\d][\d,\.]{4,})/i); return m ? num(m[1]) : ""; } },
  { p: "IssuanceDataGroup/Issuance/GoverningLaw/CountryCode", l: "Governing law", fn: t => { const h = LAWS.find(([r]) => r.test(t)); return h ? h[1] : ""; } },
  { p: "IssuanceDataGroup/Issuance/Listing/ListingVenue/Market", l: "Listing venue", fn: t => { if (!/listing|admission to trading/i.test(t)) return ""; const h = VENUES.find(([r]) => r.test(t)); return h ? h[1] : ""; } },
  { p: "IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraCode", l: "TEFRA", fn: t => { const m = t.match(/TEFRA\s*([CD])\b/i); return m ? "TEFRA_" + m[1].toUpperCase() : ""; } },
  { p: "IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode", l: "Regulation S category", fn: t => { const m = t.match(/(?:Regulation S|Reg\.?\s?S)[^\n]{0,40}Category\s*([123])/i); return m ? "REGS_CAT" + m[1] : (/regulation s/i.test(t) ? "" : ""); } },
  { p: "IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction", l: "PRIIPs restriction", fn: t => (/prohibition of sales to eea retail/i.test(t) ? "NO_EEA" : (/prohibition of sales to uk retail/i.test(t) ? "NO_UK" : "")) },
  { p: "IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType", l: "Manufacturer target market", fn: t => (/eligible counterparties and professional clients only/i.test(t) ? (/uk mifir|united kingdom domestic law/i.test(t) ? "UK_MIFIR_PROF_AND_ECPS" : "EU_MIFIDII_PROF_AND_ECPS") : "") },
  { p: "IssuanceDataGroup/Product/DayCountFraction", l: "Day count fraction", fn: t => { const m = t.match(/(30\/360|30E\/360|Actual\/Actual\s*\(ICMA\)|ACT\/ACT|Actual\/360|Actual\/365)/i); if (!m) return ""; const x = m[1].toLowerCase(); return x.indexOf("icma") > -1 ? "ICMA_ACT/ACT" : x.indexOf("act/act") > -1 ? "ACT/ACT" : x.indexOf("360") > -1 && x.indexOf("30") === 0 ? "30/360" : x.indexOf("actual/360") > -1 ? "ACT/360" : x.indexOf("actual/365") > -1 ? "ACT/365" : ""; } },
  { p: "IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/InterestPaymentFrequency", l: "Coupon frequency", fn: t => (/semi-?annual/i.test(t) ? "SEMIANNUALLY" : (/quarterly/i.test(t) ? "QUARTERLY" : (/annual/i.test(t) ? "ANNUALLY" : ""))) },
  { p: "x:spreadSet", l: "Spread set", fn: t => { const m = t.match(/(?:MS|mid-?swaps?|spread)\s*\+\s*(\d{1,3})\s*(?:bps?|basis points)?/i); return m ? "MS + " + m[1] : ""; } },
  { p: "x:iptSpread", l: "Initial price thoughts", fn: t => { const m = t.match(/(?:IPTs?|initial price thoughts)[^\d]{0,20}([A-Za-z\s\+]{0,12}\d{1,3}\s*(?:area|bps?)?)/i); return m ? m[1].trim() : ""; } },
  { p: "x:bookSize", l: "Order book", fn: t => { const m = t.match(/books?[^\.\n]{0,40}(?:in excess of|above|over|at)\s+((?:EUR|USD|GBP)?\s?[\d\.,]+\s?(?:bn|billion|m|million))/i); return m ? m[1].trim() : ""; } }
];

const AGENCIES = [[/moody'?s/i, "MOODYS"], [/(?:standard\s*&\s*poor|s&p|sandp)/i, "SNPG"], [/fitch/i, "FITCH"], [/dbrs/i, "DBRS"], [/scope/i, "SCOPE"]];

function toISO(raw) {
  if (!raw) return "";
  let m = raw.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = raw.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = raw.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

function num(s) { return String(s).replace(/[,\s]/g, ""); }

function scaled(amount, unit) {
  const n = Number(num(amount)); if (!isFinite(n)) return "";
  const u = (unit || "").toLowerCase();
  if (/^b/.test(u)) return String(n * 1e9);
  if (/^m/.test(u)) return String(n * 1e6);
  return String(n);
}

function txt(nd, name) { const e = [...nd.getElementsByTagName("*")].find(x => x.localName === name); return e ? e.textContent.trim() : ""; }

export function ingestBDT(state, xmlText, src, parser) {
  /* returns [{kind:'field'|'group', ...}] for review */
  const out = [];
  const v = p => state.f[p] ?? "";
  const propose = (p, l, val2, s) => out.push({ kind: "field", p, l, val: String(val2), cur: String(v(p) || ""), src: s });
  const proposeGroup = (g, label, payload, s) => out.push({ kind: "group", g, l: GROUPS[g].t + " list", val: label, cur: (state[g] || []).length + " entries", payload, src: s });
  /* `parser` lets this run outside a browser (pass a jsdom DOMParser in Node) */
  const P = parser || (typeof DOMParser !== "undefined" ? new DOMParser() : null);
  if (!P) throw new Error("ingestBDT needs a DOMParser: pass one in as the fourth argument outside the browser");
  const doc = P.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return 0;
  const root = doc.documentElement.getElementsByTagName("*")[0];
  if (!root || root.localName !== "ICMABondDataTaxonomy") return 0;
  const byPath = {};
  (function walk(nd, path) {
    const kids = [...nd.children];
    if (!kids.length) { if (nd.textContent.trim()) byPath[path] = nd.textContent.trim(); return; }
    kids.forEach(k => walk(k, path ? path + "/" + k.localName : k.localName));
  })(root, "");
  FIELDS.forEach(fd => {
    if (fd.t === "group" || fd.ext) return;
    const val = byPath[fd.p];
    if (val === undefined || String(v(fd.p)) === String(val)) return;
    propose(fd.p, fd.l, val, src);
  });
  const parties = [...root.getElementsByTagName("*")].filter(e => e.localName === "Party");
  if (parties.length) {
    const list = parties.map(p => ({
      PartyName: txt(p, "PartyName"), LEIIdentifier: txt(p, "LEIIdentifier"), BICIdentifier: txt(p, "BICIdentifier"),
      CountryOfIncorporation: txt(p, "CountryOfIncorporation"), PartyType: txt(p, "PartyType"),
      Roles: [...p.getElementsByTagName("*")].filter(e => e.localName === "PartyRoleType").map(e => e.textContent.trim()),
      Ratings: [...p.getElementsByTagName("*")].filter(e => e.localName === "Rating").map(r => ({ RatingAgency: txt(r, "RatingAgency"), RatingValue: txt(r, "RatingValue"), RatingOutlook: txt(r, "RatingOutlook") }))
    }));
    proposeGroup("parties", `${list.length} parties`, list, src);
  }
  const ids = [...root.getElementsByTagName("*")].filter(e => e.localName === "SecurityIdentifier")
    .map(e => e.children[0]).filter(Boolean).map(c => ({ Type: c.localName, Value: c.textContent.trim() }));
  if (ids.length) { proposeGroup("ids", ids.map(i => i.Type + " " + i.Value).join(", "), ids, src); }
  const dd = [...root.getElementsByTagName("*")].filter(e => e.localName === "DocumentDetail")
    .map(e => ({ DocumentName: txt(e, "DocumentName"), DocumentDate: txt(e, "DocumentDate"), DocumentLink: txt(e, "DocumentLink"), DocumentVersion: txt(e, "DocumentVersion") }));
  if (dd.length) { proposeGroup("docs", `${dd.length} documents`, dd, src); }
  return out;
}

export function ingestText(state, text, src) {
  const out = [];
  const v = p => state.f[p] ?? "";
  const propose = (p, l, val2, s) => out.push({ kind: "field", p, l, val: String(val2), cur: String(v(p) || ""), src: s });
  const proposeGroup = (g, label, payload, s) => out.push({ kind: "group", g, l: GROUPS[g].t + " list", val: label, cur: (state[g] || []).length + " entries", payload, src: s });
  const t = text.replace(/\u00a0/g, " ");
  RULES.forEach(r => {
    let val = "";
    try { val = r.fn(t) || ""; } catch (e) { val = ""; }
    if (!val) return;
    if (String(v(r.p)).trim() === String(val).trim()) return;
    propose(r.p, r.l, String(val).trim(), src);
  });
  const isin = (t.match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/g) || []).find(validISIN);
  const cc = (t.match(/common code[:\s]{1,12}(\d{9})/i) || [])[1];
  if (isin || cc) {
    const list = [];
    if (isin) list.push({ Type: "ISIN", Value: isin });
    if (cc) list.push({ Type: "COMMON_CODE", Value: cc });
    if (JSON.stringify(list) !== JSON.stringify(state.ids)) { proposeGroup("ids", list.map(i => i.Type + " " + i.Value).join(", "), list, src); }
  }
  const found = [];
  /* each agency is matched only against its own scale, so a Moody's rating nearby cannot be read as a Fitch one */
  const MOODYS = /\b(Aaa|Aa[123]|A[123]|Baa[123]|Ba[123]|B[123]|Caa[123])(?![A-Za-z0-9])/;
  const SP = /\b(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?|CCC[+-]?)(?![A-Za-z0-9])/;
  AGENCIES.forEach(([re, code]) => {
    const idx = t.search(re);
    if (idx < 0) return;
    const win = t.slice(idx, idx + 70);
    const m = win.match(code === "MOODYS" ? MOODYS : SP);
    if (m) found.push({ RatingAgency: code, RatingValue: m[1], RatingOutlook: "" });
  });
  if (found.length && JSON.stringify(found) !== JSON.stringify(state.ratings)) { proposeGroup("ratings", found.map(r => r.RatingAgency + " " + r.RatingValue).join(", "), found, src); }
  const lei = (t.match(/\b([A-Z0-9]{20})\b/g) || []).find(validLEI);
  if (lei && state.parties[0] && !state.parties[0].LEIIdentifier) {
    const list = JSON.parse(JSON.stringify(state.parties)); list[0].LEIIdentifier = lei;
    proposeGroup("parties", "issuer LEI " + lei, list, src);
  }
  return out;
}
