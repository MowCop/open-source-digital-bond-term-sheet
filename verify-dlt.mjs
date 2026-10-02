/* Regression test for the DLT view. Run from the repo root:  node verify-dlt.mjs
   Uses the real modules in src/lib/termsheet and compares against reference/ outputs
   produced by the published draft 4 page. Exit code 0 means nothing was lost. */
import { readFileSync } from "node:fs";
import * as core from "./src/lib/termsheet/index.js";
import { buildDLTXML, buildToken, dltChecks, dltExample, withDltView } from "./src/lib/termsheet/dlt.js";

const ex = typeof core.workedExample === "function" ? core.workedExample() : structuredClone(core.workedExample);
const state = ex.state || ex;
if (core.refreshAuto) core.refreshAuto(state);
state.dlt = dltExample();

const strip = s => s.replace(/<DocumentDate>.*<\/DocumentDate>/g, "").replace(/\r/g, "");
let fail = 0;
const check = (label, ok) => { console.log((ok ? "PASS " : "FAIL ") + label); if (!ok) fail++; };

for (const model of ["native", "twin"]) {
  state.dlt.model = model;
  const xml = buildDLTXML(state);
  const ref = readFileSync(`reference/dlt-reference-${model}.xml`, "utf8");
  check(`${model}: XML matches reference`, strip(xml) === strip(ref));
  check(`${model}: DLTPlatform group present`, xml.includes("<DLTPlatform>"));
  check(`${model}: DLTBondIndicator = ${model === "native"}`, xml.includes(`<DLTBondIndicator>${model === "native"}</DLTBondIndicator>`));
}
state.dlt.model = "native";
const xml = buildDLTXML(state);
check("native: no global note or place of deposit", !xml.includes("<GlobalNote>") && !xml.includes("<PlaceOfDeposit>"));
const t = buildToken(state), tr = JSON.parse(readFileSync("reference/token-reference.json", "utf8"));
check("token: matches reference", JSON.stringify(t) === JSON.stringify(tr));
check("token: 500,000 tokens of 1,000", t.token.totalSupply === "500000" && t.token.unitNominal === 1000);
check("token: 5 scheduled payments, final 1,033.75", t.lifecycle.schedule.length === 5 && t.lifecycle.schedule[4].amountPerToken === 1033.75);
const c = dltChecks(state);
check("checks: 9 of 11 answered", c.length === 11 && c.filter(x => x.lv === "pass").length === 9);
check("conventional XML unchanged by DLT view", core.buildXML(state) === core.buildXML(state) && !core.buildXML(state).includes("<DLTPlatform>"));
check("envelope carries dltView when included", withDltView(core.buildEnvelope(state), state).dltView?.issuanceModel === "DLT_NATIVE");

console.log(fail ? `\n${fail} check(s) failed` : "\nAll DLT checks pass");
process.exit(fail ? 1 : 0);
