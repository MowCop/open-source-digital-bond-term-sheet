import fs from 'fs';
const src=[
 ['icma-a8','ICMA Primary Market Handbook — Appendix A8 (final terms & pricing supplement pro formas, Sept 2018)','reference/ICMA-Primary-Market-Handbook-Appendix-A8-260918.txt'],
 ['checker-capabilities','VDR Deal Checker capabilities (living reference: rules, conventions, ESG, registries)','reference/deal-checker-capabilities.md'],
 ['bdt-xsd','ICMA Bond Data Taxonomy v2.0 XSD (data dictionary)','schema/icma-bond-data-taxonomy.xsd'],
 ['bdt-enums','ICMA Bond Data Taxonomy v2.0 enumerations','schema/icma-bond-data-taxonomy-enums.xsd'],
 ['bdt-types','ICMA Bond Data Taxonomy v2.0 type restrictions','schema/icma-bond-data-taxonomy-type-restrictions.xsd'],
 ['bdt-example','ICMA BDT v2.0 basic vanilla bond example','schema/icma-bond-data-taxonomy-v2-basic-vanilla-bond.xml'],
];
let out='// GENERATED from reference/ and schema/ by the Co-Pilot library sync. Regenerate when those files change; do not edit by hand.\nexport const LIBRARY: { id: string; title: string; source: string; text: string }[] = [\n';
for(const [id,title,p] of src){out+=`  { id: ${JSON.stringify(id)}, title: ${JSON.stringify(title)}, source: ${JSON.stringify(p)}, text: ${JSON.stringify(fs.readFileSync(p,'utf8'))} },\n`;}
fs.writeFileSync('supabase/functions/deal-copilot/knowledge/library.ts',out+'];\n');
