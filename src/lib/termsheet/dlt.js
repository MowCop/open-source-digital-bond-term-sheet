/* DLT view (VDR draft 4). Converts the term sheet state into
   (1) BDT 2.0 XML with the DLTPlatform group populated and
   (2) a token descriptor JSON for a tokenisation platform.
   Pure: reads `state`, returns values, touches no DOM and never writes to state
   except creating state.dlt with defaults if it is missing.
   Self-contained on purpose: it does not modify bdt-xml.js. It takes the
   conventional tree from buildTree(state), deep-copies it, edits the copy,
   and re-sorts with its own sortTree that honours `keep` (PlatformIdentifier
   children MIC, LEI, DTI, BlockChainAddress must keep schema order and are
   not in ORDER["Identifier"]). Question numbers refer to the ICMA DLT Bonds
   Reference Guide (December 2024). */
import { STAGES } from "./fields.js";
import { ORDER } from "./order.js";
import { buildTree } from "./bdt-xml.js";

const esc = s => String(s == null ? "" : s).replace(/[<>&"]/g, m => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[m]));
function node(name) { return { n: name, c: [], t: null }; }
function cloneTree(nd) { return { n: nd.n, t: nd.t, keep: nd.keep, c: nd.c.map(cloneTree) }; }
function ensure(root, parts) {
  let cur = root;
  parts.forEach(p => { let k = cur.c.find(x => x.n === p); if (!k) { k = node(p); cur.c.push(k); } cur = k; });
  return cur;
}
function sortTree(nd) {
  const ord = ORDER[nd.n];
  if (ord && !nd.keep) nd.c.sort((a, b) => {
    const ia = ord.indexOf(a.n), ib = ord.indexOf(b.n);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  nd.c.forEach(sortTree);
  return nd;
}
function ser(nd, d) {
  const pad = "  ".repeat(d);
  if (nd.t !== null && !nd.c.length) return `${pad}<${nd.n}>${esc(nd.t)}</${nd.n}>`;
  if (!nd.c.length) return `${pad}<${nd.n}/>`;
  return `${pad}<${nd.n}>\n` + nd.c.map(k => ser(k, d + 1)).join("\n") + `\n${pad}</${nd.n}>`;
}

/* ============================================================
   DLT view: the same deal record expressed as a DLT bond.
   Two outputs from one set of inputs:
   1. BDT 2.0 XML with the DLTPlatform group populated
      (validates against icma-bond-data-taxonomy.xsd), and
   2. a token descriptor (JSON) a tokenisation platform can map
      to its own smart contract.
   Questions are numbered after the ICMA DLT Bonds Reference
   Guide (December 2024) so a banker can trace each field.
   ============================================================ */
export const DLT_ROLES = [
  ["ISSUANCE_SETTLEMENT", "Primary issuance and settlement"],
  ["OWNERSHIP_RECORD", "Record and transfer of ownership"],
  ["LIFECYCLE", "Coupon and redemption payments"],
  ["REPORTING", "Reporting and sustainability disclosure"]
];
export const DLT_E = {
  access: ["PERMISSIONED", "PRIVATE", "CONSORTIUM", "HYBRID", "SEMI_PUBLIC", "PUBLIC"],
  registrar: ["CENTRAL_ACCOUNT_KEEPER", "TOKENISATION_MANAGER", "CRYPTO_SECURITIES_REGISTRAR", "REGISTRAR", "CSD_ICSD"],
  standard: ["ERC-3643", "ERC-1400", "ERC-20", "CIP-56", "Platform proprietary"],
  cash: ["Commercial bank money, off-chain", "Wholesale CBDC", "Central bank money via DLT trigger", "Tokenised bank deposits", "E-money token (MiCAR)"],
  record: ["On-chain register", "Off-chain register at the ICSD", "Off-chain register at the registrar"],
  bridge: ["None", "Euroclear", "Clearstream", "Euroclear and Clearstream"]
};
export function dltDefault() {
  return {
    model: "", include: false, roles: [],
    name: "", type: "", access: "", operator: "", operatorLei: "", decentralised: "false",
    registrar: "", mic: "", dti: "", chainAddress: "", contractName: "", contractAddress: "",
    standard: "", symbol: "", fee: "", cash: "", cycle: "", record: "", bridge: "",
    platformLaw: "", fallback: ""
  };
}

export const DLT_FIELDS = [
  ["Ledger", [
    ["name", "Platform name", "text", null, "5a", "As the platform is named in the offering documentation."],
    ["type", "Network or ledger technology", "text", null, "5b", "For example Hyperledger Besu, Canton or Ethereum."],
    ["access", "Accessibility", "sel", "access", "5c"],
    ["operator", "Platform operator", "text", null, "5a"],
    ["operatorLei", "Operator LEI", "text", null, "5a"],
    ["decentralised", "Operation is decentralised", "bool", null, "5c"],
    ["registrar", "Registration role on the platform", "sel", "registrar", "5d", "The DLT-specific role the operator performs: central account keeper (Luxembourg), crypto securities registrar (Germany) and so on."],
    ["mic", "Platform MIC", "text", null, "5a", "Only if the platform is a trading venue."],
    ["platformLaw", "Law governing the platform rulebook", "text", null, "3d", "ISO country code. Say so here if it differs from the law governing the notes."]
  ]],
  ["Token", [
    ["standard", "Token standard", "sel", "standard", "7c"],
    ["contractName", "Smart contract name", "text", null, "7a"],
    ["contractAddress", "Smart contract address", "text", null, "7a", "Usually known only once the token is deployed, often after pricing."],
    ["chainAddress", "Platform address on chain", "text", null, "5b"],
    ["dti", "Digital token identifier (DTI)", "text", null, "5b", "ISO 24165. A functionally fungible group DTI is used where a conventional twin exists."],
    ["symbol", "Token symbol", "text", null, null, "Left empty, it is derived from the issuer, coupon and maturity."],
    ["fee", "Platform fees", "text", null, "6a"]
  ]],
  ["Settlement and record", [
    ["record", "Definitive record of holdings", "sel", "record", "28b"],
    ["cash", "Cash leg", "sel", "cash", "36a"],
    ["cycle", "Settlement cycle", "text", null, "39", "For example T+0 atomic, or T+5 to align with the conventional tranche."],
    ["bridge", "Link to the ICSDs", "sel", "bridge", "54c"],
    ["fallback", "Fallback if the ledger fails", "ta", null, "9b", "How the notes would move to a conventional structure, such as a global note in the ICSDs."]
  ]]
];


/* Everything below reads the deal state through this scope. */
function scope(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";
  const D = () => { if (!state.dlt) state.dlt = dltDefault(); return state.dlt; };
/* ---------- conversion helpers ---------- */
const STEP = { ANNUALLY: 12, SEMIANNUALLY: 6, QUARTERLY: 3, MONTHLY: 1, BIMONTHLY: 2, BIANNUALLY: 24 };
function addMonths(iso, m) {
  const d = new Date(iso + "T00:00:00Z"); const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + m);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10);
}
function couponDates() {
  const first = v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/FirstPayment/PaymentDate");
  const mat = v("IssuanceDataGroup/Product/Maturity/MaturityDate");
  const step = STEP[v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/InterestPaymentFrequency")];
  if (!first || !mat || !step) return [];
  const out = []; let d = first, i = 0;
  while (d < mat && i < 400) { out.push(d); i++; d = addMonths(first, step * i); }
  out.push(mat); return [...new Set(out)];
}
function issuerParty() { return state.parties.find(p => (p.Roles || []).includes("ISSUER")) || {}; }
function tokenSymbol() {
  if (D().symbol) return D().symbol;
  const iss = (issuerParty().PartyName || "").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/)[0] || "BOND";
  const cpn = v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate");
  const yy = (v("IssuanceDataGroup/Product/Maturity/MaturityDate") || "").slice(2, 4);
  return [iss.slice(0, 4).toUpperCase(), cpn, yy].filter(Boolean).join(" ");
}
function roleText() {
  const r = D().roles.map(k => (DLT_ROLES.find(x => x[0] === k) || [k, k])[1]);
  if (D().model === "twin") r.unshift("Digital twin of an ICSD-held security; the ICSD record is definitive");
  return r.join("; ");
}
function leaf(name, val) { const k = node(name); k.t = String(val); return k; }
function dropPath(root, parts) {
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) { cur = cur.c.find(x => x.n === parts[i]); if (!cur) return; }
  cur.c = cur.c.filter(x => x.n !== parts[parts.length - 1]);
}
function setLeaf(root, parts, val) { const n = ensure(root, parts); n.c = []; n.t = String(val); }

/* ---------- 1. BDT 2.0 XML with the DLT group ---------- */
function buildDLTTree() {
  const d = D(), root = cloneTree(buildTree(state)), native = d.model === "native";
  const IDG = "IssuanceDataGroup";
  setLeaf(root, [IDG, "Product", "DLTBondIndicator"], native ? "true" : "false");

  if (native) {
    /* a DLT-native note has no global note, depositary or safekeeping structure */
    ["InitialFormOfNote", "AfterExchangeFormOfNote", "FinalFormOfNote", "SafeKeepingStructure"].forEach(n => dropPath(root, [IDG, "Product", n]));
    setLeaf(root, [IDG, "Product", "InitialFormOfNote", "PhysicalFormOfNote"], "DEMATERIALISED");
    setLeaf(root, [IDG, "Product", "InitialFormOfNote", "LegalTitleFormOfNote"], d.record === "On-chain register" ? "REGISTERED" : "BOOK_ENTRY");
    ["GlobalNoteIdentifier", "PlaceOfDeposit"].forEach(n => dropPath(root, [IDG, "Issuance", n]));
    if (!d.bridge || d.bridge === "None") ["SecuritiesClearingSystem", "SecuritiesSettlementSystem"].forEach(n => dropPath(root, [IDG, "Issuance", n]));
    if (d.operator) {
      const pg = ensure(root, [IDG, "PartyGroup"]);
      const p = node("Party"); p.c.push(leaf("PartyName", d.operator));
      if (d.operatorLei) p.c.push(leaf("LEIIdentifier", d.operatorLei));
      ["PLATFORM_OPERATOR", d.registrar].filter(Boolean).forEach(r => { const pr = node("PartyRole"); pr.c.push(leaf("PartyRoleType", r)); p.c.push(pr); });
      pg.c.push(p);
    }
  }
  if (d.dti) {
    const sl = ensure(root, [IDG, "Product", "SecurityIdentifierList"]);
    const si = node("SecurityIdentifier"); si.c.push(leaf("DTI", d.dti)); sl.c.push(si);
  }

  /* DLTPlatform, children in schema order */
  const iss = ensure(root, [IDG, "Issuance"]);
  iss.c = iss.c.filter(x => x.n !== "DLTPlatform");
  const P = node("DLTPlatform");
  if (d.type) P.c.push(leaf("Type", d.type));
  if (d.access) P.c.push(leaf("Accessibility", d.access));
  if (roleText()) P.c.push(leaf("Role", roleText()));
  if (d.operator) {
    const op = node("Operator"), party = node("Operator");
    party.c.push(leaf("PartyName", d.operator));
    if (d.operatorLei) party.c.push(leaf("LEIIdentifier", d.operatorLei));
    const pr = node("PartyRole"); pr.c.push(leaf("PartyRoleType", "PLATFORM_OPERATOR")); party.c.push(pr);
    op.c.push(party); op.c.push(leaf("Decentralised", d.decentralised === "true" ? "true" : "false"));
    P.c.push(op);
  }
  if (d.name) P.c.push(leaf("Name", d.name));
  if (d.fee) P.c.push(leaf("Fee", d.fee));
  const id = node("Identifier"); id.keep = true;
  if (d.mic) id.c.push(leaf("MIC", d.mic));
  if (d.operatorLei) id.c.push(leaf("LEI", d.operatorLei));
  if (d.dti) id.c.push(leaf("DTI", d.dti));
  if (d.chainAddress) id.c.push(leaf("BlockChainAddress", d.chainAddress));
  if (id.c.length) P.c.push(id);
  if (d.contractName || d.contractAddress || d.standard) {
    const sc = node("SmartContract");
    if (d.contractName) sc.c.push(leaf("SmartContractName", d.contractName));
    sc.c.push(leaf("SmartContractType", native ? "Security token issuance and servicing" : "Digital twin mirror"));
    if (d.contractAddress) sc.c.push(leaf("SmartContractAddress", d.contractAddress));
    const tk = node("Token"); tk.c.push(leaf("TokenType", "SECURITY"));
    if (d.standard) tk.c.push(leaf("TokenTechnicalReference", d.standard));
    sc.c.push(tk); P.c.push(sc);
  }
  if (P.c.length) iss.c.push(P);
  return sortTree(root);
}
function buildDLTXML() {
  const inner = ser(buildDLTTree(), 1);
  const m = D().model === "native" ? "DLT-native bond" : "digital twin of a conventional bond";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- VDR DLT view: ${m}. Stage: ${STAGES[state.stage - 1].t}. Version ${state.ver}.\n     BDT 2.0 payload with the DLTPlatform group. The legal documentation prevails over this digital record. -->\n<Document xmlns="urn:icma:xsd:ICMABondDataTaxonomy">\n${inner}\n</Document>\n`;
}

/* ---------- 2. Token descriptor ---------- */
function buildToken() {
  const d = D(), native = d.model === "native";
  const den = Number(v("IssuanceDataGroup/Issuance/SpecifiedDenomination/Value")) || null;
  const size = Number(v("IssuanceDataGroup/Issuance/TotalAggregateAmount/Value")) || null;
  const rate = Number(v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate"));
  const freq = v("IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/InterestPaymentFrequency");
  const per = STEP[freq] ? 12 / STEP[freq] : null;
  const mult = Number(v("IssuanceDataGroup/Issuance/IntegralMultiples/Value")) || null;
  const unit = mult && den && mult < den && den % mult === 0 ? mult : den;   /* one token per tradable increment */
  const minTokens = unit && den ? den / unit : null;
  const regular = unit && rate && per ? +(unit * rate / 100 / per).toFixed(2) : null;
  const dates = couponDates(), mat = v("IssuanceDataGroup/Product/Maturity/MaturityDate");
  const tm = v("IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType");
  const priips = v("IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction");
  const regs = v("IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode");
  const claims = [];
  if (/PROF_AND_ECPS$/.test(tm)) claims.push("PROFESSIONAL_CLIENT_OR_ECP");
  if (regs && !/NA|NoCode/.test(regs)) claims.push("NON_US_PERSON");
  if (priips === "NO_EEA") claims.push("NOT_EEA_RETAIL");
  if (priips === "NO_UK" || v("IssuanceDataGroup/Issuance/SellingRestrictions/CCIRestriction") === "APPLICABLE") claims.push("NOT_UK_RETAIL");
  const iss = issuerParty();
  return {
    vdrTokenDescriptor: "0.1",
    notice: "Descriptor for mapping to a tokenisation platform. It is not deployable code: the platform's smart contract, rulebook and the offering documentation govern.",
    issuanceModel: native ? "DLT_NATIVE" : "DIGITAL_TWIN",
    definitiveRecord: d.record || (native ? null : "Off-chain register at the ICSD"),
    instrument: {
      name: v("IssuanceDataGroup/Product/SecurityShortName") || state.deal || null,
      issuer: { name: iss.PartyName || null, lei: iss.LEIIdentifier || null },
      isin: (state.ids.find(x => x.Type === "ISIN") || state.ids.find(x => x.Type === "TEMPORARY_ISIN") || {}).Value || null,
      dti: d.dti || null,
      currency: v("IssuanceDataGroup/Issuance/SpecifiedCurrency") || null,
      nominalAmount: size, denomination: den,
      issueDate: v("IssuanceDataGroup/Issuance/IssueDate") || null, maturityDate: mat || null,
      seniority: v("IssuanceDataGroup/Product/StatusOfNote/Seniority") || null,
      governingLaw: v("IssuanceDataGroup/Issuance/GoverningLaw/CountryCode") || null,
      platformLaw: d.platformLaw || null
    },
    token: {
      standard: d.standard || null, type: "SECURITY", symbol: tokenSymbol(),
      decimals: 0, unitNominal: unit,
      totalSupply: size && unit ? String(Math.round(size / unit)) : null,
      mint: { date: v("IssuanceDataGroup/Issuance/SettlementDate") || null, to: native ? "Issuer distribution wallet, then managers' wallets against payment" : "Mirror of ICSD positions" },
      burn: { date: mat || null, reason: "Redemption at maturity" }
    },
    network: {
      platform: d.name || null, ledger: d.type || null, accessibility: d.access || null,
      operator: d.operator ? { name: d.operator, lei: d.operatorLei || null, decentralised: d.decentralised === "true" } : null,
      registrationRole: d.registrar || null, contract: d.contractAddress || null, platformAddress: d.chainAddress || null
    },
    compliance: {
      identityRegistry: "Required. Only whitelisted, identity-verified wallets may hold or receive tokens.",
      eligibilityClaims: claims,
      minimumHolding: minTokens ? minTokens + " tokens (" + den + " " + (v("IssuanceDataGroup/Issuance/SpecifiedCurrency") || "") + " nominal, the minimum denomination)" : null,
      transferIncrement: unit ? "1 token (" + unit + " nominal). A transfer that leaves either wallet holding fewer than the minimum, other than zero, is rejected." : null
    },
    lifecycle: {
      automated: d.roles.includes("LIFECYCLE"),
      dayCount: v("IssuanceDataGroup/Product/DayCountFraction") || null,
      coupon: rate ? { rate: rate, frequency: freq || null, regularAmountPerToken: regular } : null,
      schedule: dates.map((dt, i) => ({ date: dt, event: dt === mat ? "COUPON_AND_REDEMPTION" : "COUPON", amountPerToken: dt === mat && unit ? +(unit + (regular || 0)).toFixed(2) : regular, note: i === 0 ? "First period may be broken; confirm with the calculation agent" : undefined })),
      redemption: { date: mat || null, percentOfNominal: Number(v("IssuanceDataGroup/Issuance/Redemption/FinalRedemptionPercentage")) || 100 }
    },
    settlement: {
      model: v("IssuanceDataGroup/Issuance/Delivery") || null, cashLeg: d.cash || null, cycle: d.cycle || null,
      settlementDate: v("IssuanceDataGroup/Issuance/SettlementDate") || null, icsdLink: d.bridge || null
    },
    fallback: d.fallback || null,
    references: {
      bdtPayload: (v("DocumentInformation/DocumentId") || "termsheet") + ".dlt.xml",
      stage: STAGES[state.stage - 1].k, termSheetVersion: state.ver,
      legalPrevails: true
    }
  };
}

/* ---------- readiness against the ICMA DLT Bonds Reference Guide ---------- */
function dltChecks() {
  const d = D(), out = [], native = d.model === "native";
  const add = (q, l, ok, msg, level) => out.push({ q, l, lv: ok ? "pass" : (level || "warn"), msg });
  add("Q1", "Role of DLT stated", d.roles.length, "Tick what the ledger does for this bond.", "fail");
  add("Q3d", "Platform governing law", d.platformLaw, "State the law governing the platform rulebook.");
  add("Q5a", "Operator identified", d.operator && d.operatorLei, "Name the operator and give its LEI.", "fail");
  add("Q5b", "Digital token identifier", d.dti, "Add the DTI once assigned.");
  add("Q7c", "Token standard", d.standard, "Choose the token standard.", "fail");
  add("Q28", "Definitive record", d.record, "Say which record is definitive for legal purposes.", "fail");
  add("Q35", "Settlement model", has("IssuanceDataGroup/Issuance/Delivery"), "Set DvP or free of payment on the Fill tab.");
  if (v("IssuanceDataGroup/Issuance/Delivery") === "DVP") add("Q36", "Cash leg for DvP", d.cash, "Say what form of cash settles the DvP.", "fail");
  add("Q39", "Settlement cycle", d.cycle, "State the target settlement cycle.");
  if (native) {
    add("Q9", "Fallback if the ledger fails", d.fallback, "Describe how the notes would move to a conventional structure.", "fail");
    const tefra = v("IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraCode");
    if (/TEFRA_[CD]/.test(tefra)) add("Q16b", "TEFRA category", false, `${tefra.replace("_", " ")} is set but the DLT-native notes are in registered form. Confirm the category with counsel.`);
    if (has("IssuanceDataGroup/Issuance/PlaceOfDeposit") && (!d.bridge || d.bridge === "None")) add("Q24", "Place of deposit", false, "The conventional record names an ICSD depositary. The DLT view drops it because no ICSD link is set.");
  } else {
    add("Q37c", "Link to the conventional security", d.dti || d.bridge && d.bridge !== "None", "Give a DTI or ICSD link so the twin can be matched to the ISIN.");
  }
  return out;
}

/* ---------- what changes between the two records ---------- */
function dltDiffRows() {
  const native = D().model === "native", d = D();
  const conv = {
    form: [v("IssuanceDataGroup/Product/InitialFormOfNote/LegalTitleFormOfNote"), v("IssuanceDataGroup/Product/SafeKeepingStructure")].filter(Boolean).join(", ") || "Global note",
    hold: v("IssuanceDataGroup/Issuance/PlaceOfDeposit") || "Common safekeeper or depositary",
    settle: [v("IssuanceDataGroup/Issuance/SecuritiesSettlementSystem/Code"), v("IssuanceDataGroup/Issuance/Delivery")].filter(Boolean).join(", ") || "ICSD",
    pay: (state.parties.find(p => (p.Roles || []).includes("PRINCIPAL_PAYING_AGENT")) || {}).PartyName || "Principal paying agent"
  };
  return [
    ["Form of note", conv.form, native ? "Dematerialised token, " + (d.record === "On-chain register" ? "registered on chain" : "book entry") : "Unchanged. The token mirrors the global note"],
    ["Record of holders", conv.hold, native ? (d.record || "Choose the definitive record") : "ICSD record is definitive; ledger mirrors it"],
    ["Settlement", conv.settle, [d.name || "Platform", d.cash, d.cycle].filter(Boolean).join(", ")],
    ["Coupon and redemption", conv.pay, d.roles.includes("LIFECYCLE") ? "Smart contract pays " + (d.cash ? d.cash.charAt(0).toLowerCase() + d.cash.slice(1) : "the cash leg") + " to token holders" : conv.pay + ", off chain"],
    ["Identifiers", (state.ids.find(x => /ISIN/.test(x.Type)) || {}).Value || "ISIN", [((state.ids.find(x => /ISIN/.test(x.Type)) || {}).Value), d.dti && "DTI " + d.dti].filter(Boolean).join(" + ") || "ISIN, DTI to follow"]
  ];
}


  return { buildDLTTree, buildDLTXML, buildToken, dltChecks, dltDiffRows, couponDates, tokenSymbol };
}

export const buildDLTXML = state => scope(state).buildDLTXML();
export const buildDLTTree = state => scope(state).buildDLTTree();
export const buildToken = state => scope(state).buildToken();
export const dltChecks = state => scope(state).dltChecks();
export const dltDiffRows = state => scope(state).dltDiffRows();
export const couponSchedule = state => scope(state).couponDates();

/* Envelope add-on: call after buildEnvelope(state) instead of editing envelope.js. */
export function withDltView(envelope, state) {
  const d = state.dlt, id = (state.f["DocumentInformation/DocumentId"] || "document");
  return Object.assign({}, envelope, {
    dltView: d && d.include && d.model ? {
      issuanceModel: d.model === "native" ? "DLT_NATIVE" : "DIGITAL_TWIN",
      platform: d.name || null,
      payloads: [
        { format: "ICMA-BDT", version: "2.0.0", encoding: "xml", group: "DLTPlatform", reference: id + ".dlt.xml" },
        { format: "VDR-TOKEN-DESCRIPTOR", version: "0.1", encoding: "json", reference: id + ".token.json" }
      ]
    } : null
  });
}

/* Worked-example DLT settings (fictional), to sit beside workedExample(). */
export function dltExample() {
  return Object.assign(dltDefault(), {
    model: "native", include: true, roles: ["ISSUANCE_SETTLEMENT", "OWNERSHIP_RECORD", "LIFECYCLE"],
    name: "Meridian Ledger", type: "Hyperledger Besu", access: "PERMISSIONED",
    operator: "Meridian Digital Markets S.A.", operatorLei: "529900MERIDLEDGER076", decentralised: "false",
    registrar: "CENTRAL_ACCOUNT_KEEPER", platformLaw: "LU", standard: "ERC-3643", contractName: "AurelisBond2031",
    cash: "Central bank money via DLT trigger", cycle: "T+5, atomic DvP on the settlement date", record: "On-chain register",
    bridge: "Euroclear and Clearstream", fallback: "If the platform cannot operate, the issuer may replace the notes with a permanent global note held through Euroclear, under the conversion mechanics in the base prospectus."
  });
}
