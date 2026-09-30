/* Proves the extracted modules reproduce the reference implementation exactly.
   Run: node verify.mjs  (from the handover folder) */
import { readFileSync, writeFileSync } from "fs";
import { workedExample } from "./src/example.js";
import { buildXML } from "./src/bdt-xml.js";
import { buildEnvelope } from "./src/envelope.js";
import { checks, tally } from "./src/validate.js";
import { legendBlocks } from "./src/legends.js";
import { sheetRows } from "./src/termsheet.js";
import { FIELDS } from "./src/fields.js";

const state = workedExample();
const xml = buildXML(state);
writeFileSync("module-output.xml", xml);
const t = tally(state);
console.log("fields in dictionary :", FIELDS.length);
console.log("checks               :", JSON.stringify(t));
console.log("legend blocks        :", legendBlocks(state).length);
console.log("term sheet rows      :", sheetRows(state).length);
console.log("envelope keys        :", Object.keys(buildEnvelope(state)).length);
const ref = readFileSync(process.argv[2] || "reference-output.xml", "utf8");
console.log("XML identical to reference implementation :", xml === ref ? "YES" : "NO");
if (xml !== ref) {
  const a = xml.split("\n"), b = ref.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log("  first difference at line", i + 1, "\n   modules :", a[i], "\n   reference:", b[i]); break; }
}

/* assisted fill smoke test */
import { ingestBDT, ingestText } from "./src/ingest.js";
import { emptyState } from "./src/model.js";
const blank = emptyState();
blank.parties = [{ PartyName: "", LEIIdentifier: "", Roles: ["ISSUER"], Ratings: [] }];
const { JSDOM } = await import("/home/claude/node_modules/jsdom/lib/api.js").catch(() => ({ JSDOM: null }));
const parser = JSDOM ? new (new JSDOM("").window.DOMParser)() : undefined;
const fromXml = ingestBDT(blank, readFileSync(process.argv[3] || "schema/icma-bond-data-taxonomy-v2-basic-vanilla-bond.xml", "utf8"), "sample.xml", parser);
console.log("BDT XML import proposals :", fromXml.length);
const fromText = ingestText(blank, "EUR 750,000,000 3.25 per cent. Notes due 2031. Issue price 99.612. ISIN SK4000029237. Listing: Luxembourg Stock Exchange. Governing law: English law. Pricing Date: 7 April 2026. MS + 40", "sample.txt");
console.log("prose import proposals   :", fromText.length, "->", fromText.map(p => p.l).join(", "));
