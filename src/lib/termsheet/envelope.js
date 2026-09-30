/* The VDR routing envelope: stage, lineage, authorisation and the execution fields BDT does not model. */
import { FIELDS, STAGES } from "./fields.js";
import { tally } from "./validate.js";

export function buildEnvelope(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const ex = {};
  FIELDS.filter(x => x.ext && has(x.p)).forEach(x => { ex[x.p.slice(2)] = v(x.p); });
  const last = state.releases[state.releases.length - 1];
  return {
    vdrEnvelope: "0.1",
    dealIdentifier: v("IssuanceDataGroup/Issuance/DealIdentifier") || null,
    dealName: state.deal || null,
    documentId: v("DocumentInformation/DocumentId"),
    documentVersion: state.ver,
    supersedes: last ? last.documentId : null,
    executionStage: STAGES[state.stage - 1].k,
    executionStageLabel: STAGES[state.stage - 1].t,
    snapshot: true,
    generatedAt: new Date().toISOString(),
    authorisedBy: last ? last.by : null,
    instrument: {
      issuer: (state.parties.find(p => (p.Roles || []).includes("ISSUER")) || {}).PartyName || null,
      currency: v("IssuanceDataGroup/Issuance/SpecifiedCurrency") || null,
      size: v("IssuanceDataGroup/Issuance/TotalAggregateAmount/Value") || v("IssuanceDataGroup/Issuance/MaximumAmount/Value") || null,
      maturityDate: v("IssuanceDataGroup/Product/Maturity/MaturityDate") || null,
      isin: (state.ids.find(x => x.Type === "ISIN") || {}).Value || null,
      temporaryIsin: (state.ids.find(x => x.Type === "TEMPORARY_ISIN") || {}).Value || null
    },
    execution: ex,
    bookrunners: state.parties.filter(p => (p.Roles || []).some(r => /MANAGER|BOOKRUNNER|COORDINATOR/.test(r))).map(p => ({ name: p.PartyName, lei: p.LEIIdentifier || null, roles: p.Roles })),
    documents: state.docs.map(d => ({ name: d.DocumentName, date: d.DocumentDate || null, link: d.DocumentLink || null, version: d.DocumentVersion || null })),
    distribution: { channels: ["api", "mcp", "email", "instant_bloomberg"], recipients: "governed by the bookrunners on this deal" },
    checks: tally(state),
    payload: { format: "ICMA-BDT", version: "2.0.0", encoding: "xml", reference: (v("DocumentInformation/DocumentId") || "document") + ".xml" }
  };
}