import { externalState } from '@/lib/fieldStatus';
import { P, parseAmount, type BdtState } from '@/lib/bdt-bridge';
import type { DealWorkspace } from '@/lib/dealWorkspace';
import { termSheetView } from '@/lib/termSheetView';
import { trancheBdtState } from '@/lib/trancheState';
import { sizeHeadline, spreadConvention } from '@/lib/execution';
import { ALERT_EVENTS, buildSubject, escapeHtml, termsDiff } from '@/lib/newIssueAlerts';

export const MSG_WIDTH = 72;
const LABEL_WIDTH = 15;
const VALUE_COLUMN = LABEL_WIDTH + 3;
const TARGET = 'IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType';
const FLOAT = 'IssuanceDataGroup/Product/InterestPayment/FloatingRatePayment/';
export interface MsgInput {
  state: BdtState; ws?: DealWorkspace | null; borrower: string;
  event: Parameters<typeof buildSubject>[1]; notes?: string; legalNotices?: string[];
}
export interface MsgLine { text: string; key?: string; block?: string; value?: string }

/** Preserve paragraphs; split even unbroken identifiers rather than overflow. */
export function wrapMsg(value: string, width = MSG_WIDTH): string[] {
  return value.replace(/\r\n?/g, '\n').split('\n').flatMap(paragraph => {
    let rest = paragraph.trim();
    if (!rest) return [''];
    const out: string[] = [];
    while (rest.length > width) {
      let cut = rest.lastIndexOf(' ', width);
      if (cut <= 0) cut = width;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) out.push(rest);
    return out;
  });
}
const readable = (v: string) => v.replace(/_/g, ' ');
const amount = (v: number) => v >= 1e9 ? `${+(v / 1e9).toFixed(6)}bn` : v >= 1e6 ? `${+(v / 1e6).toFixed(6)}m` : String(v);

/** Structured lines drive plain text and highlighting without parsing UI markup. */
export function buildMsgLines(a: MsgInput): MsgLine[] {
  a = { ...a, state: externalState(a.state) };
  const main = termSheetView(a.state);
  const tranches = a.ws?.tranches ?? [];
  const multi = tranches.length > 1;
  const lines: MsgLine[] = [];
  const text = (s: string) => lines.push(...wrapMsg(s).map(text => ({ text })));
  // Reuse the subject's date-derived tenor and lifecycle suffix, with no 'Issuer' fallback.
  const subject = buildSubject(a.state, a.event, '', tranches[0]?.tenor ?? '');
  const suffix = ALERT_EVENTS.find(e => e.id === a.event)?.suffix ?? '';
  const summary = subject.split(' – ').slice(1, -1).join(' ');
  text([`${(a.borrower || main.issuerName).toUpperCase()}${main.issuerRating ? ` (${main.issuerRating})` : ''}`, multi ? `${tranches.length} TRANCHES` : summary, suffix.toUpperCase()].filter(Boolean).join(' '));
  lines.push({ text: '' });
  if (a.notes?.trim()) { text(a.notes); lines.push({ text: '' }); }

  const row = (label: string, value: string, key: string, block: string) => {
    if (!value.trim()) return;
    wrapMsg(value, MSG_WIDTH - VALUE_COLUMN).forEach((part, i) => lines.push({
      text: (i === 0 ? label.toUpperCase().padEnd(LABEL_WIDTH) + ' : ' : ' '.repeat(VALUE_COLUMN)) + part,
      key, block, value,
    }));
  };
  const head = sizeHeadline(a.state, a.ws ?? null);
  if (multi && tranches.some(t => t.currency)) {
    row('SIZE', head.text.toUpperCase(), 'dealSize', 'DEAL');
    if (new Set(tranches.map(t => t.currency)).size > 1) {
      row('CCY TOTALS', head.perCurrency.join(', ').toUpperCase(), 'currencyTotals', 'DEAL');
      if (head.fx.length) row('FX', head.fx.join('; '), 'fx', 'DEAL');
    }
  }
  const count = Math.max(1, tranches.length);
  for (let i = 0; i < count; i++) {
    const t = tranches[i];
    const state = externalState(trancheBdtState(a.state, a.ws ?? null, i));
    const v = termSheetView(state);
    const field = (p: string) => state.f[p]?.trim() ?? '';
    const block = multi ? `TRANCHE ${t?.label || String.fromCharCode(65 + i)}` : 'DEAL';
    const currency = v.currency || (!a.state.fieldMeta ? t?.currency : '') || '';
    // Main BDT amounts are authoritative for A; other tranche overlays may still
    // contain a deal-wide total, so prefer their own nominal amount/details.
    const nominal = parseAmount(field(P.nominalAmount));
    const size = i === 0 ? v.size.replace(new RegExp(`^${currency}\\s+`), '') : Number.isFinite(nominal) ? amount(nominal) : !a.state.fieldMeta && t?.amount != null ? amount(t.amount) : '';
    const tenorRecord = a.state.fieldMeta?.[`tranche:${t?.id}:tenor`];
    const tenor = v.tenor || (tenorRecord?.status === 'expected' ? '' : t?.tenor) || '';
    if (multi) {
      lines.push({ text: '-----' });
      text([block, currency, size, tenor, readable(field(P.interestType))].filter(Boolean).join(' '));
    }
    const add = (label: string, value: string, key: string) => row(label, value, key, block);
    add('ISSUER', v.issuerName, 'issuerName');
    add('RATINGS', v.issuerRating, 'issuerRating');
    add('FORMAT', [readable(v.issuanceType), readable(v.formOfNote)].filter(Boolean).join(' / '), 'format');
    add('STATUS', readable(v.statusOfNote), 'status');
    const indication = field('x:sizeIndication');
    add('SIZE', size ? [currency, size].filter(Boolean).join(' ') : multi ? (currency ? [currency, indication || 'BENCHMARK'].join(' ').toUpperCase() : '') : (field('x:sizeMsg') || field('x:sizeSkew')) ? head.text.toUpperCase() : '', 'size');
    if (!multi && size && field('x:sizeSkew')) add('SKEW', field('x:sizeSkew').toUpperCase(), 'skew');
    add('TENOR', tenor, 'tenor');
    add('SETTLEMENT', v.settlementDate, 'settlementDate');
    add('MATURITY', v.maturityDate, 'maturityDate');
    const floating = /FLOAT/i.test(field(P.interestType));
    const floatingCoupon = [readable(field(FLOAT + 'Benchmark/BenchmarkCode')), field(FLOAT + 'Spread/Value') ? `+ ${field(FLOAT + 'Spread/Value')} ${field(FLOAT + 'Spread/PriceType')}`.trim() : ''].filter(Boolean).join(' ');
    add('COUPON', floating ? floatingCoupon : v.coupon, 'coupon');
    const talk = (v: string) => v.toUpperCase().replace(/\s*(?:\+\/-|±)\s*/g, ' +/- ');
    if (a.event !== 'mandate') {
      add('IPTS', talk(field(P.ipt)), 'ipt');
      add('PRICE TALK', talk(field('x:priceTalk')), 'priceTalk');
      add('YIELD TALK', talk(field('x:yieldTalk')), 'yieldTalk');
    }
    if (!['mandate', 'ipt'].includes(a.event)) add('GUIDANCE', talk(field(P.guidance)), 'guidance');
    if (a.event !== 'mandate' && (field(P.ipt) || field(P.guidance))) add('SPREAD VS', spreadConvention(state.f), 'spreadConvention');
    if (['launch', 'pricing', 'final', 'books'].includes(a.event)) add('SPREAD', field(P.spreadSet) || v.reofferSpread, 'reofferSpread');
    if (['pricing', 'final'].includes(a.event)) {
      add('RE-OFFER', v.reofferPrice, 'reofferPrice');
      add('RE-OFFER YIELD', v.reofferYield, 'reofferYield');
    }
    add('DENOMS', v.specifiedDenomination, 'specifiedDenomination');
    add('LISTING', v.listingVenue, 'listingVenue');
    add('GOV LAW', readable(v.governingLaw), 'governingLaw');
    add('BOOKRUNNERS', v.bookrunners.map(b => b.name).filter(Boolean).join(', '), 'bookrunners');
    // IDs are deal-wide in legacy overlays; never claim A's ISIN belongs to B.
    add('ISIN', i === 0 ? v.isin : String(t?.values['isin'] ?? t?.values['ISIN'] ?? ''), 'isin');
  }
  // Legal wording must remain byte-for-byte unchanged, even if a supplied line
  // exceeds 72 columns. All generated lines above/below remain fixed width.
  for (const legal of a.legalNotices ?? []) if (legal.trim()) {
    lines.push({ text: '' }, ...legal.split('\n').map(text => ({ text })));
  }
  if (a.state.f[TARGET]?.trim()) { lines.push({ text: '' }); text(`TARGET MARKET (MIFID II): ${readable(a.state.f[TARGET])}`); }
  if (a.state.f['x:stabilisation']?.trim()) text(`FCA/ICMA STABILISATION: ${readable(a.state.f['x:stabilisation'])}${a.state.f['x:stabPeriod'] ? ` / ${a.state.f['x:stabPeriod']}` : ''}`);
  return lines;
}
export const buildMsgText = (a: MsgInput) => buildMsgLines(a).map(l => l.text).join('\n');
export const msgEmailBlock = (text: string) => `<pre data-msg-text="true" style="font-family:ui-monospace,'Courier New',monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>`;

/** New sends preserve the exact per-tranche message in their existing HTML
 * snapshot. Legacy sends only support the terms their BDT snapshot records. */
export function changedMsgLines(a: MsgInput, before: BdtState | null, previousText?: string): Set<number> {
  const lines = buildMsgLines(a);
  const changed = new Set<number>();
  if (!before) return changed;
  if (previousText) {
    const prior = new Map<string, string>();
    let block = 'DEAL', label = '', value = '';
    const flush = () => { if (label) prior.set(`${block}:${label}`, value); label = ''; value = ''; };
    for (const line of previousText.split('\n')) {
      if (line.startsWith('TRANCHE ')) { flush(); block = line.split(/\s+/).slice(0, 2).join(' '); }
      else if (/^[A-Z -]+ : /.test(line)) { flush(); label = line.slice(0, LABEL_WIDTH).trim(); value = line.slice(VALUE_COLUMN); }
      else if (label && line.startsWith(' '.repeat(VALUE_COLUMN))) value += ' ' + line.trim();
      else flush();
    }
    flush();
    lines.forEach((l, i) => { if (l.key && l.block) {
      const first = lines.find(x => x.block === l.block && x.key === l.key);
      const label = first?.text.slice(0, LABEL_WIDTH).trim();
      if (prior.get(`${l.block}:${label}`) !== l.value?.replace(/\s+/g, ' ').trim()) changed.add(i);
    } });
    return changed;
  }
  const keys = new Set(termsDiff(before, a.state).map(d => d.key));
  const prev = buildMsgLines({ ...a, state: before, ws: null });
  const extra = ['format', 'status', 'ipt', 'guidance', 'tenor', 'priceTalk', 'yieldTalk', 'dealSize', 'skew'];
  for (const key of extra) if (prev.find(l => l.key === key)?.value !== lines.find(l => l.key === key)?.value) keys.add(key);
  lines.forEach((l, i) => { if (l.key && keys.has(l.key) && (!a.ws || a.ws.tranches.length <= 1 || l.block === `TRANCHE ${a.ws.tranches[0]?.label || 'A'}` || ['issuerName', 'issuerRating', 'bookrunners', 'governingLaw', 'listingVenue'].includes(l.key))) changed.add(i); });
  return changed;
}