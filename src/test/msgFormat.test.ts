import { describe, expect, it } from 'vitest';
import { P, type BdtState } from '@/lib/bdt-bridge';
import type { DealWorkspace } from '@/lib/dealWorkspace';
import { buildMsgText, buildMsgLines, changedMsgLines, msgEmailBlock, wrapMsg } from '@/lib/msgFormat';

const state = (): BdtState => ({
  stage: 5, deal: 'Acme', ver: '1', seq: 1, contacts: [],
  parties: [{ PartyName: 'Acme SA', Roles: ['ISSUER'], LEIIdentifier: '', Ratings: [] } as never,
    { PartyName: 'Example Syndicate Bank', Roles: ['JOINT_LEAD_MANAGER'], LEIIdentifier: '', Ratings: [] } as never],
  f: { [P.currency]: 'USD', [P.totalAmount]: '500000000', [P.nominalAmount]: '500000000', [P.coupon]: '4.25', [P.maturityDate]: '2031-06-15', [P.settlementDate]: '2026-06-15', [P.ipt]: 'T+200 area', [P.guidance]: 'T+180', [P.spreadSet]: 'T+170', [P.reofferPrice]: '99.9' },
  ratings: [], ids: [{ Type: 'ISIN', Value: 'XS1234567890' }], docs: [], releases: [], suggestions: [], files: [],
});
const args = () => ({ state: state(), borrower: 'Acme SA', event: 'pricing' as const });
const ws = (): DealWorkspace => ({ version: 1, shared: {}, plannedTotals: {}, fx: {}, tranches: [
  { id: 'a', label: 'A', rateType: 'fixed', currency: 'USD', amount: 500e6, tenor: '5Y', values: {} },
  { id: 'b', label: 'B', rateType: 'floating', currency: 'EUR', amount: 350e6, tenor: '7Y', values: { [P.currency]: 'EUR', [P.nominalAmount]: '350000000', [P.interestType]: 'FLOATING', [P.maturityDate]: '2033-06-15', 'IssuanceDataGroup/Product/InterestPayment/FloatingRatePayment/Benchmark/BenchmarkCode': 'EURIBOR' } },
] });

describe('MSG formatter', () => {
  it('aligns every generated label at column 15 and value at 18', () => {
    const lines = buildMsgLines(args()).filter(l => l.key && l.text.includes(' : '));
    expect(lines.length).toBeGreaterThan(5);
    for (const l of lines) { expect(l.text.indexOf(' : ')).toBe(15); expect(l.text[18]).not.toBe(' '); }
  });
  it('limits generated lines to 72 characters and uses hanging value indents', () => {
    const a = args(); a.state.parties.push({ PartyName: 'Syndicate Bank '.repeat(15).trim(), Roles: ['JOINT_LEAD_MANAGER'] } as never);
    const lines = buildMsgLines({ ...a, notes: 'A commentary paragraph '.repeat(30) });
    expect(Math.max(...lines.map(l => l.text.length))).toBeLessThanOrEqual(72);
    const br = lines.filter(l => l.key === 'bookrunners');
    expect(br.length).toBeGreaterThan(1);
    expect(br[1].text.startsWith(' '.repeat(18))).toBe(true);
    expect(wrapMsg('X'.repeat(150)).map(l => l.length)).toEqual([72, 72, 6]);
  });
  it('renders each tranche with its own saved amounts, currency, maturity and rate', () => {
    const out = buildMsgText({ ...args(), ws: ws() });
    expect(out).toContain('TRANCHE A USD 500m 5Y');
    expect(out).toContain('TRANCHE B EUR 350m 7Y FLOATING');
    expect(out.match(/^-----$/gm)).toHaveLength(2);
    const b = out.split('TRANCHE B')[1];
    expect(b).toContain('SIZE            : EUR 350m');
    expect(b).toContain('MATURITY        : 2033-06-15');
    expect(b).toContain('COUPON          : EURIBOR');
    expect(b).not.toContain('4.25%');
    expect(b).not.toContain('XS1234567890');
    expect(out).not.toContain('[object Object]');
    expect(out).not.toContain('USD USD');
  });
  it('does not invent empty terms or legal statements', () => {
    const s = state(); s.f = {}; s.parties = []; s.ids = [];
    const text = buildMsgText({ state: s, borrower: '', event: 'mandate' });
    expect(text).not.toMatch(/ISSUER\s+:|SIZE\s+:|COUPON\s+:|TARGET MARKET|STABILISATION|TBD/);
  });
  it('retains exact legal wording after terms and only includes recorded regulatory notices', () => {
    const legal = 'This is a supplied legal notice. '.repeat(5) + '\n  Indented source wording.';
    const a = args(); a.state.f['IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType'] = 'EU_MIFIDII_PROF_AND_ECPS'; a.state.f['x:stabilisation'] = 'APPLICABLE';
    const out = buildMsgText({ ...a, legalNotices: [legal] });
    expect(out).toContain(legal);
    expect(out.indexOf(legal)).toBeGreaterThan(out.indexOf('ISIN'));
    expect(out.indexOf('TARGET MARKET (MIFID II):')).toBeGreaterThan(out.indexOf(legal));
    expect(out).toContain('FCA/ICMA STABILISATION: APPLICABLE');
  });
  it('only includes available execution terms appropriate to the selected event', () => {
    expect(buildMsgText({ ...args(), event: 'mandate' })).not.toMatch(/IPTS\s+:|GUIDANCE\s+:|RE-OFFER\s+:/);
    expect(buildMsgText({ ...args(), event: 'ipt' })).toContain('IPTS            : T+200 area');
    expect(buildMsgText({ ...args(), event: 'ipt' })).not.toMatch(/GUIDANCE\s+:|RE-OFFER\s+:/);
    expect(buildMsgText(args())).toContain('RE-OFFER        : 99.9');
  });
  it('highlights changed coupon against the last sent BDT snapshot', () => {
    const before = state(); const a = args(); a.state.f[P.coupon] = '4.5';
    const changed = changedMsgLines(a, before);
    expect([...changed].map(i => buildMsgLines(a)[i].key)).toEqual(['coupon']);
    expect(changedMsgLines(args(), before).size).toBe(0);
    expect(changedMsgLines(a, null).size).toBe(0);
  });
  it('compares a new sent MSG snapshot per tranche, including hanging lines', () => {
    const w = ws(); const a = { ...args(), ws: w };
    const prior = buildMsgText(a);
    expect(changedMsgLines(a, a.state, prior).size).toBe(0);
    const next = ws(); next.tranches[1].values[P.nominalAmount] = '400000000'; next.tranches[1].amount = 400e6;
    const current = { ...a, ws: next };
    const changed = [...changedMsgLines(current, a.state, prior)].map(i => buildMsgLines(current)[i]);
    expect(changed.map(l => [l.block, l.key])).toEqual([['TRANCHE B', 'size']]);
  });
  it('escapes MSG text safely in the email pre block', () => {
    const out = msgEmailBlock('<script>alert("test")</script> & terms');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
    expect(out).toContain('data-msg-text="true"');
  });
});