import fs from 'fs';
const src=[
 ['icma-handbook-2026','ICMA Primary Market Handbook — complete edition, last updated May 2026 (preferred handbook reference)','reference/ICMA-Primary-Market-Handbook-May-2026.txt'],
 ['icma-a8','ICMA Primary Market Handbook — Appendix A8 (final terms & pricing supplement pro formas, Sept 2018)','reference/ICMA-Primary-Market-Handbook-Appendix-A8-260918.txt'],
 ['icma-c1','ICMA Primary Market Handbook — Appendix C1 (Bond Data Taxonomy: purpose, legal nature, use in digital term sheets, May 2026)','reference/ICMA-Primary-Market-Handbook-AppendixC1-BDT-2026.txt'],
 ['icma-dlt-faq','ICMA FAQ — DLT and blockchain in bond markets (Sept 2022)','reference/ICMA-DLT-and-blockchain-in-bond-markets-FAQ-220922.txt'],
 ['hkma-digital-green-2026','HKMA press release — HKSAR Government fourth Digital Green Bonds (Sept 2026; real DLT bond, BDT v2.0, HSBC Orion, CMU, T+1)','reference/HKMA-HKSAR-Fourth-Digital-Green-Bonds-20260929.md'],
 ['checker-capabilities','VDR Deal Checker capabilities (living reference: rules, conventions, ESG, registries)','reference/deal-checker-capabilities.md'],
 ['bdt-xsd','ICMA Bond Data Taxonomy v2.0 XSD (data dictionary)','schema/icma-bond-data-taxonomy.xsd'],
 ['bdt-enums','ICMA Bond Data Taxonomy v2.0 enumerations','schema/icma-bond-data-taxonomy-enums.xsd'],
 ['bdt-types','ICMA Bond Data Taxonomy v2.0 type restrictions','schema/icma-bond-data-taxonomy-type-restrictions.xsd'],
 ['bdt-example','ICMA BDT v2.0 basic vanilla bond example','schema/icma-bond-data-taxonomy-v2-basic-vanilla-bond.xml'],
];
let out='// GENERATED from reference/ and schema/ by the Co-Pilot library sync. Regenerate when those files change; do not edit by hand.\nexport const LIBRARY: { id: string; title: string; source: string; text: string }[] = [\n';
for(const [id,title,p] of src){out+=`  { id: ${JSON.stringify(id)}, title: ${JSON.stringify(title)}, source: ${JSON.stringify(p)}, text: ${JSON.stringify(fs.readFileSync(p,'utf8'))} },\n`;}
fs.writeFileSync('supabase/functions/deal-copilot/knowledge/library.ts',out+'];\n');
