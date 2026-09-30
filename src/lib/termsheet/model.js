/* Shared state shape and helpers. Every other module is pure: it takes `state` and returns a value. */
import { FIELDS, GROUPS, STAGES } from "./fields.js";

export function emptyState() {
  return {
    stage: 1, deal: "", ver: "0.1", seq: 0,
    f: {}, contacts: [], parties: [], ids: [], ratings: [], docs: [],
    releases: [], suggestions: [], files: []
  };
}
export const val = (state, p) => state.f[p] ?? "";
export const hasVal = (state, p) => String(val(state, p)).trim() !== "";
export function filled(state, fd) {
  if (fd.t === "group") return !!(state[fd.g] && state[fd.g].length);
  return hasVal(state, fd.p);
}
/* Auto-maintained fields. Call after any change before generating output. */
export function refreshAuto(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const deal = v("IssuanceDataGroup/Issuance/DealIdentifier") || "UNASSIGNED";
  state.f["DocumentInformation/BDTVersion"] = "2.0.0";
  state.f["DocumentInformation/DocumentId"] = `${deal}-${String(state.seq + 1).padStart(3, "0")}`;
  state.f["DocumentInformation/DocumentVersion"] = state.ver;
  state.f["DocumentInformation/DocumentDescription"] =
    `${STAGES[state.stage - 1].t} term sheet — ${state.deal || "untitled deal"}`;
  if (!state.f["DocumentInformation/DocumentDate"]) state.f["DocumentInformation/DocumentDate"] = new Date().toISOString().slice(0, 10);
  state.f["DocumentInformation/DocumentStatus"] = state.stage >= 7 ? "ISSUED" : (v("DocumentInformation/DocumentStatus") === "WITHDRAWN" ? "WITHDRAWN" : "PENDING");
  const ex = FIELDS.filter(x => x.ext && has(x.p)).map(x => `${x.l}: ${v(x.p)}`);
  state.f["IssuanceDataGroup/Issuance/AdditionalIssuanceInformation"] =
    `VDR execution stage: ${STAGES[state.stage - 1].t}.` + (ex.length ? " " + ex.join("; ") + "." : "");
}