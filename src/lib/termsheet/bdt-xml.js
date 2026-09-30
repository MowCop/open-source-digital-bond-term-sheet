/* BDT 2.0 XML serialisation.
   Sibling order comes from ORDER (generated from the XSD), NOT from declaration order,
   so fields may be added to the dictionary in any position without breaking validity. */
import { FIELDS, STAGES } from "./fields.js";
import { ORDER } from "./order.js";

const esc = s => String(s == null ? "" : s).replace(/[<>&"]/g, m => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[m]));
const MULTI = ["SellingRestrictions/CountryRestrictions", "BusinessDayCenter/CityCalendar"];

function node(name) { return { n: name, c: [], t: null }; }
function ensure(root, parts) {
  let cur = root;
  parts.forEach(p => {
    let k = cur.c.find(x => x.n === p);
    if (!k) { k = node(p); cur.c.push(k); }
    cur = k;
  });
  return cur;
}
function sortTree(nd) {
  const ord = ORDER[nd.n];
  if (ord) nd.c.sort((a, b) => {
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

export function buildTree(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const root = node("ICMABondDataTaxonomy");
  FIELDS.forEach(fd => {
    if (fd.ext) return;
    if (fd.t === "group") return;
    if (!has(fd.p)) return;
    const parts = fd.p.split("/");
    if (MULTI.some(m => fd.p.endsWith(m))) {
      const parent = ensure(root, parts.slice(0, -1));
      String(v(fd.p)).split(",").map(s => s.trim()).filter(Boolean).forEach(val => {
        const k = node(parts[parts.length - 1]); k.t = val; parent.c.push(k);
      });
      return;
    }
    const leaf = ensure(root, parts); leaf.t = String(v(fd.p)).trim();
  });
  /* repeating groups */
  const di = ensure(root, ["DocumentInformation"]);
  di.c = di.c.filter(x => x.n !== "DocumentContacts");
  state.contacts.forEach(c => {
    const g = node("DocumentContacts");
    if (c.Name) { const k = node("Name"); k.t = c.Name; g.c.push(k); }
    if (c.Email) { const k = node("Email"); k.t = c.Email; g.c.push(k); }
    if (g.c.length) di.c.push(g);
  });
  if (state.parties.length) {
    const pg = ensure(root, ["IssuanceDataGroup", "PartyGroup"]);
    state.parties.forEach(p => {
      const pn = node("Party");
      const add = (n, val) => { if (val) { const k = node(n); k.t = val; pn.c.push(k); } };
      add("PartyName", p.PartyName); add("LEIIdentifier", p.LEIIdentifier); add("BICIdentifier", p.BICIdentifier);
      add("CountryOfIncorporation", p.CountryOfIncorporation);
      (p.Roles || []).forEach(r => { const pr = node("PartyRole"); const k = node("PartyRoleType"); k.t = r; pr.c.push(k); pn.c.push(pr); });
      add("PartyType", p.PartyType);
      if ((p.Ratings || []).some(r => r.RatingAgency || r.RatingValue)) {
        const rg = node("PartyRating");
        p.Ratings.forEach(r => {
          if (!(r.RatingAgency || r.RatingValue)) return;
          const rt = node("Rating");
          [["RatingAgency", r.RatingAgency], ["RatingValue", r.RatingValue], ["RatingOutlook", r.RatingOutlook]].forEach(([n, val]) => { if (val) { const k = node(n); k.t = val; rt.c.push(k); } });
          rg.c.push(rt);
        });
        pn.c.push(rg);
      }
      pg.c.push(pn);
    });
  }
  if (state.docs.length) {
    const doc = ensure(root, ["IssuanceDataGroup", "Issuance", "IssuanceDocumentation"]);
    state.docs.forEach(d => {
      const dd = node("DocumentDetail");
      [["DocumentName", d.DocumentName], ["DocumentDate", d.DocumentDate], ["DocumentLink", d.DocumentLink], ["DocumentVersion", d.DocumentVersion]]
        .forEach(([n, val]) => { if (val) { const k = node(n); k.t = val; dd.c.push(k); } });
      if (dd.c.length) doc.c.push(dd);
    });
  }
  if (state.ids.length) {
    const sl = ensure(root, ["IssuanceDataGroup", "Product", "SecurityIdentifierList"]);
    state.ids.forEach(x => {
      if (!x.Value) return;
      const si = node("SecurityIdentifier"); const k = node(x.Type); k.t = x.Value; si.c.push(k); sl.c.push(si);
    });
  }
  if (state.ratings.length) {
    const rg = ensure(root, ["IssuanceDataGroup", "Product", "ExpectedProductRating"]);
    state.ratings.forEach(r => {
      if (!(r.RatingAgency || r.RatingValue)) return;
      const rt = node("Rating");
      [["RatingAgency", r.RatingAgency], ["RatingValue", r.RatingValue], ["RatingOutlook", r.RatingOutlook]].forEach(([n, val]) => { if (val) { const k = node(n); k.t = val; rt.c.push(k); } });
      rg.c.push(rt);
    });
  }
  return sortTree(root);
}

export function buildXML(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const inner = ser(buildTree(state), 1);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- VDR digital term sheet. Stage: ${STAGES[state.stage - 1].t}. Version ${state.ver}.\n     BDT 2.0 payload. The legal documentation prevails over this digital record. -->\n<Document xmlns="urn:icma:xsd:ICMABondDataTaxonomy" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:icma:xsd:ICMABondDataTaxonomy icma-bond-data-taxonomy.xsd">\n${inner}\n</Document>\n`;
}