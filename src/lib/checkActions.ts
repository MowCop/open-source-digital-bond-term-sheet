/**
 * Deal Checker actions: where a check points in the Fill form, and the
 * deterministic "Try to fix" repairs that are safe to offer on a click.
 * Reads the vendored FIELDS dictionary; never modifies src/lib/termsheet/.
 */
import { FIELDS } from '@/lib/termsheet/index.js';
import type { BdtState, CheckItem } from '@/lib/bdt-bridge';

export type CheckTarget = { kind: 'field'; path: string; sec: string } | { kind: 'group'; g: string; sec: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F = FIELDS as any[];
const groupSec = (g: string) => F.find(f => f.t === 'group' && f.g === g)?.sec ?? '';
const group = (g: string): CheckTarget => ({ kind: 'group', g, sec: groupSec(g) });
const fieldByLabel = (label: string): CheckTarget | null => {
  const fd = F.find(f => f.t !== 'group' && f.l.toLowerCase() === label.trim().toLowerCase());
  return fd ? { kind: 'field', path: fd.p, sec: fd.sec } : null;
};

export function checkTarget(c: CheckItem): CheckTarget | null {
  const text = `${c.t} ${c.d ?? ''}`;
  if (/required fields? (are|is) empty/i.test(c.t) && c.d) return fieldByLabel(c.d.split(';')[0].replace(/…$/, ''));
  if (/\bLEI\b|GLEIF|part(y|ies)|ISSUER role|issuer identified|managers?/i.test(c.t)) return group('parties');
  if (/ISIN|common code|FIGI|CUSIP|identifier/i.test(text)) return group('ids');
  if (/document/i.test(c.t)) return group('docs');
  if (/rating/i.test(c.t)) return group('ratings');
  if (/contact/i.test(c.t)) return group('contacts');
  // Longest field label mentioned in the title wins.
  const t = c.t.toLowerCase();
  const hit = F.filter(f => f.t !== 'group' && f.l.length > 3 && t.includes(f.l.toLowerCase()))
    .sort((a, b) => b.l.length - a.l.length)[0];
  if (hit) return { kind: 'field', path: hit.p, sec: hit.sec };
  const words: Record<string, RegExp> = { 'Pricing date': /pricing/i, 'Issue date': /issue date/i, 'Maturity date': /maturity/i, 'Coupon': /coupon/i };
  for (const [label, re] of Object.entries(words)) if (re.test(c.t)) { const x = fieldByLabel(label); if (x) return x; }
  return null;
}

type Row = Record<string, string>;
export interface CheckFix { label: string; apply: (s: BdtState) => BdtState }

/** A safe, explicit repair for this check, or null when it needs a human. */
export function checkFix(c: CheckItem, state: BdtState): CheckFix | null {
  const ids = (state.ids ?? []) as unknown as Row[];
  const parties = (state.parties ?? []) as unknown as Row[];
  if (/^FIGI available but not recorded/.test(c.t)) {
    const figi = c.d?.match(/BBG[A-Z0-9]{9}/)?.[0];
    if (figi) return { label: `Add FIGI ${figi}`, apply: s => ({ ...s, ids: [...(s.ids ?? []), { Type: 'FIGI', Value: figi }] }) };
  }
  if (/^No common code/.test(c.t)) {
    const isin = (ids.find(x => x.Type === 'ISIN')?.Value ?? '').trim().toUpperCase();
    // Euroclear/Clearstream XS ISINs embed the 9-digit common code.
    if (/^XS\d{9}\d$/.test(isin)) {
      const code = isin.slice(2, 11);
      return { label: `Add common code ${code} from ISIN`, apply: s => ({ ...s, ids: [...(s.ids ?? []), { Type: 'COMMON_CODE', Value: code }] }) };
    }
  }
  const mm = c.t.match(/^LEI name mismatch: (.+)$/);
  const legal = c.d?.match(/registers ([A-Z0-9]{20}) to "(.+)"/);
  if (mm && legal) {
    const [, lei, name] = legal;
    if (parties.some(p => (p.LEIIdentifier ?? '').toUpperCase() === lei))
      return { label: `Use GLEIF legal name "${name}"`, apply: s => ({ ...s, parties: (s.parties ?? []).map(p => (p.LEIIdentifier ?? '').toUpperCase() === lei ? { ...p, PartyName: name } : p) }) };
  }
  return null;
}

export const checkKey = (c: CheckItem) => `${c.src ?? ''}|${c.t}`;

/* ── Fixes from the last dropped document ───────────────────────────────────
   A dropped file yields pending proposals in the Fill tab. "Try to fix" may
   accept the ones matching the check's topic — an explicit click, never automatic. */
export type DocTopic = 'currency' | 'tenor' | 'benchmark' | 'bookrunner';
export interface DocProposal { kind: 'field' | 'group'; p?: string; g?: string }

export function docTopics(c: CheckItem): DocTopic[] {
  const text = `${c.t} ${c.d ?? ''}`;
  const out: DocTopic[] = [];
  if (/currenc/i.test(text)) out.push('currency');
  if (/tenor|maturity/i.test(text)) out.push('tenor');
  if (/benchmark/i.test(text)) out.push('benchmark');
  if (/bookrunner|manager|ISSUER role|\bpart(y|ies)\b/i.test(text)) out.push('bookrunner');
  return out;
}

export function proposalMatches(topic: DocTopic, pr: DocProposal): boolean {
  const p = pr.p ?? '';
  switch (topic) {
    case 'currency': return pr.kind === 'field' && /Currency/.test(p);
    case 'tenor': return pr.kind === 'field' && /Maturity/.test(p) && !/Benchmark/.test(p);
    case 'benchmark': return pr.kind === 'field' && /\/Benchmark\//.test(p);
    case 'bookrunner': return pr.kind === 'group' && pr.g === 'parties';
  }
}
