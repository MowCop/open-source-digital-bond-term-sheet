import { describe, expect, it } from 'vitest';
import { parseTalk, sizeState, sizeHeadline, spreadConvention, pricingDealCompleteness } from './index';
import { buildMsgText } from '../msgFormat';
import { transitionField, evolution } from '../fieldStatus';
import { parseExecutionCommand, prepareCommand, COMMAND_FIELDS, type CommandSnapshot } from '../../../supabase/functions/_shared/copilot-commands';
import type { BdtState } from '../bdt-bridge';
import type { DealWorkspace } from '../dealWorkspace';

const CCY = 'IssuanceDataGroup/Issuance/SpecifiedCurrency';
const state = (f: Record<string, string> = {}, stage = 3): BdtState => ({ stage, f: { [CCY]: 'USD', ...f }, parties: [{ PartyName: 'Sasol Financing USA LLC', Roles: ['ISSUER'] }], ids: [], ratings: [], docs: [], contacts: [] } as unknown as BdtState);
const ws = (a: [string, number | null, string][]): DealWorkspace => ({ version: 1, tranches: a.map(([c, amt, tenor], i) => ({ id: 't' + i, label: String.fromCharCode(65 + i), currency: c, amount: amt, tenor, rateType: 'fixed', values: {} })), plannedTotals: {}, aggregateUsd: null, fx: { EUR: { usdPerUnit: 1.1, source: 'ECB', asOf: new Date().toISOString() } } } as unknown as DealWorkspace);

describe('talk parsing', () => {
  it('area', () => expect(parseTalk('4.75% area')).toMatchObject({ low: 4.75, high: 4.75, unit: 'pct', area: true }));
  it('price range', () => expect(parseTalk('99.25-99.50')).toMatchObject({ low: 99.25, high: 99.5, unit: 'price' }));
  it('plus/minus bp with WPIR', () => expect(parseTalk('4.50% +/- 5bp WPIR')).toMatchObject({ low: 4.45, high: 4.55, unit: 'pct', wpir: true }));
  it('± spread', () => expect(parseTalk('MS+95 ± 5')).toMatchObject({ low: 90, high: 100, unit: 'bp' }));
  it('keeps text verbatim', () => expect(parseTalk(' 99.5 area ').text).toBe('99.5 area'));
});

describe('size and spread conventions', () => {
  it('benchmark is the default pre-launch state', () => { expect(sizeState('')).toMatchObject({ kind: 'benchmark' }); expect(sizeState('Benchmark (USD 500m+)').kind).toBe('benchmark'); expect(sizeState('Target USD 1bn').kind).toBe('target'); expect(sizeState('Expected / WNG').kind).toBe('wng'); expect(sizeState('500000000')).toEqual({ kind: 'numeric', amount: 5e8 }); });
  it('USD talks vs UST, EUR vs MS, override wins', () => { expect(spreadConvention({ [CCY]: 'USD' })).toBe('UST'); expect(spreadConvention({ [CCY]: 'EUR' })).toBe('MS'); expect(spreadConvention({ [CCY]: 'USD', 'x:spreadConvention': 'MS' })).toBe('MS'); });
  it('USD-equivalent headline for multi-currency deals', () => {
    const h = sizeHeadline(state(), ws([['USD', 1e9, '10Y'], ['EUR', 5e8, '5Y']]));
    expect(h.text).toBe('USD 1.55bn equivalent');
    expect(h.perCurrency).toEqual(['USD 1bn', 'EUR 500m']);
    expect(h.fx[0]).toContain('ECB');
  });
});

describe('MSG', () => {
  it('shows skew and uppercase talk', () => {
    const txt = buildMsgText({ state: state({ 'x:sizeSkew': 'Skewed to the long end', 'x:guidance': '4.50% ± 5bp WPIR' }), ws: ws([['USD', null, '10Y'], ['USD', null, '30Y']]), borrower: 'Sasol', event: 'guidance' });
    expect(txt).toMatch(/^SIZE\s+: USD BENCHMARK, SKEWED TO THE LONG END$/m);
    expect(txt).toMatch(/^GUIDANCE\s+: 4\.50% \+\/- 5BP WPIR$/m);
  });
});

describe('evolution history', () => {
  it('keeps prior values on each approved change', () => {
    let s = transitionField(state(), 'x:yieldTalk', '4.75% area', 'karl', 'Co-Pilot command: IPT');
    s = transitionField(s, 'x:yieldTalk', '4.50% +/- 5bp WPIR', 'karl', 'Co-Pilot command: guidance');
    s = transitionField(s, 'x:yieldTalk', '4.45%', 'karl', 'Co-Pilot command: priced');
    expect(evolution(s, 'x:yieldTalk').map(h => h.value)).toEqual(['4.75% area', '4.50% +/- 5bp WPIR', '4.45%']);
    expect(s.fieldMeta!['x:yieldTalk']).toMatchObject({ status: 'open', latest: true });
  });
});

describe('Co-Pilot execution commands', () => {
  const snap = (): CommandSnapshot => ({ bdt_state: { f: { [COMMAND_FIELDS.size[0]]: '500000000' } }, deal_workspace: ws([['USD', 5e8, '10Y'], ['USD', null, '30Y']]) as never, notes: null });
  it('sizes tranches by tenor', () => {
    const r = parseExecutionCommand('Size the 10s at 1bn, 30s at 750m', snap())!;
    expect(r.edits.map(e => [e.tranche, e.after])).toEqual([['A', '1bn'], ['B', '750m']]);
    const plan = prepareCommand(snap(), r);
    expect(plan.after.deal_workspace!.tranches.map(t => t.amount)).toEqual([1e9, 7.5e8]);
  });
  it('skew and USD equivalent', () => {
    expect(parseExecutionCommand('Skew to the long end', snap())!.edits[0]).toMatchObject({ field: 'skew', after: 'Skewed to the long end' });
    const r = parseExecutionCommand('Deal size 2.5bn USD equivalent', snap())!;
    const plan = prepareCommand(snap(), r);
    expect(plan.after.bdt_state.f['x:usdEquivalent']).toBe('2500000000');
    expect(plan.after.deal_workspace!.aggregateUsd).toBe(2.5e9);
  });
  it('talk needs a tranche on multi-tranche deals', () => {
    expect(() => parseExecutionCommand('Guidance 4.50% +/- 5bp WPIR', snap())).toThrow(/Say which one/);
    expect(parseExecutionCommand('Guidance tranche B 4.50% +/- 5bp WPIR', snap())!.edits[0]).toMatchObject({ tranche: 'B', field: 'guidance' });
  });
});

describe('priced completeness', () => {
  it('requires issue price, re-offer yield, coupon, sizes, total and USD equivalent to be Set', () => {
    const s = { ...state({}, 5), fieldMeta: {} } as BdtState;
    const t = pricingDealCompleteness(s, ws([['USD', null, '10Y'], ['EUR', 5e8, '5Y']])).map(c => c.t).join('\n');
    for (const w of ['Tranche A final size', 'Tranche A issue price', 'Tranche B re-offer yield', 'Tranche B coupon', 'total deal size', 'USD-equivalent total']) expect(t).toContain(w);
  });
});
