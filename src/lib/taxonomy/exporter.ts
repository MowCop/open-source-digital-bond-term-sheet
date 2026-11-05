/** BDT 2.0 exporters. Pure functions except downloadBdtFile (browser only). */
import { buildXML, refreshAuto, emptyState, sheetText } from '@/lib/termsheet/index.js';
import type { BdtDocument, BdtExportFormat } from './types';
import { BDT_STAGE_NAMES } from './validator';

export const BDT_SCHEMA = 'ICMA Bond Data Taxonomy 2.0';

function normalise(doc: BdtDocument) {
  const s = { ...emptyState(), ...doc, f: { ...doc.f } };
  refreshAuto(s);
  return s;
}

/** Nests flat element paths ("A/B/C": v) into a JSON tree under ICMABondDataTaxonomy. */
export function bdtToJsonTree(doc: BdtDocument) {
  const tree: Record<string, unknown> = {};
  for (const [path, raw] of Object.entries(doc.f)) {
    const v = String(raw ?? '').trim();
    if (!v || path.startsWith('x:')) continue;
    const parts = path.split('/');
    let node = tree as Record<string, unknown>;
    parts.slice(0, -1).forEach((k) => { node[k] = (node[k] as Record<string, unknown>) ?? {}; node = node[k] as Record<string, unknown>; });
    node[parts[parts.length - 1]] = v;
  }
  const ext = Object.fromEntries(Object.entries(doc.f).filter(([p, v]) => p.startsWith('x:') && String(v ?? '').trim()));
  return {
    schema: BDT_SCHEMA,
    stage: { number: doc.stage, name: BDT_STAGE_NAMES[doc.stage - 1] ?? '' },
    dealIdentifier: doc.deal ?? '',
    version: doc.ver ?? '',
    ICMABondDataTaxonomy: {
      ...tree,
      Parties: doc.parties ?? [],
      Identifiers: doc.ids ?? [],
      Ratings: doc.ratings ?? [],
      Documentation: doc.docs ?? [],
    },
    executionExtensions: ext,
  };
}

export const exportBdtToJson = (doc: BdtDocument): string => JSON.stringify(bdtToJsonTree(doc), null, 2);
export const exportBdtToXml = (doc: BdtDocument): string => buildXML(normalise(doc)) as string;
export const exportBdtToText = (doc: BdtDocument): string => sheetText(normalise(doc)) as string;

export function exportBdt(doc: BdtDocument, format: BdtExportFormat): { body: string; mime: string; ext: string } {
  if (format === 'json') return { body: exportBdtToJson(doc), mime: 'application/json', ext: 'json' };
  if (format === 'xml') return { body: exportBdtToXml(doc), mime: 'application/xml', ext: 'xml' };
  return { body: exportBdtToText(doc), mime: 'text/plain;charset=utf-8', ext: 'txt' };
}

/** Browser download helper. */
export function downloadBdtFile(doc: BdtDocument, format: BdtExportFormat, baseName = doc.deal || 'termsheet') {
  const { body, mime, ext } = exportBdt(doc, format);
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = `${baseName.replace(/[^\w.-]+/g, '_')}.bdt.${ext}`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
