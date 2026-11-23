// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { prepareCommand, parseDirectCommand, NoCommandChanges, unchangedCommandResult, commandConversationResult, COMMAND_FIELDS, type CommandSnapshot } from '../../../supabase/functions/_shared/copilot-commands';
const snapshot = (): CommandSnapshot => ({
  bdt_state: { f: { [COMMAND_FIELDS.size[0]]: '500000000', [COMMAND_FIELDS.size[1]]: '500000000', [COMMAND_FIELDS.currency[0]]: 'EUR' }, parties: [{ PartyName: 'Sasol Financing USA LLC', Roles: ['ISSUER'] }] },
  deal_workspace: { version: 1, tranches: [
    { id: 'a', label: 'A', currency: 'EUR', amount: 500000000, tenor: '5yr', rateType: 'floating', values: {} },
    { id: 'b', label: 'B', currency: 'USD', amount: 500000000, tenor: '10yr', rateType: 'fixed', values: {} },
  ], plannedTotals: { USD: 2000000000 }, aggregateUsd: 2000000000, fx: { EUR: { usdPerUnit: 1.2 } } },
  notes: { intro: '', notes: 'Manually edited terms\n<<HASH>>old\n<<LEGAL>>\nVerbatim legal notice' },
});
describe('Co-Pilot command previews', () => {
  it('returns a normal clarification for Tranche C 350 versus saved 350000000 without changing terms', () => {
    const saved = snapshot();
    saved.deal_workspace?.tranches.push({ id: 'c', label: 'C', currency: 'USD', amount: 350000000, rateType: 'fixed', values: {} });
    const before = structuredClone(saved);
    const request = parseDirectCommand('change Tranche C size from 350 to 400');
    if (!request) throw new Error('Missing command');
    let result;
    try { prepareCommand(saved, request); } catch (error) { result = commandConversationResult(error); }
    expect(result).toMatchObject({ status: 'needs_input', humanExecuteRequired: false });
    expect(result?.message).toContain('350m (350000000)');
    expect(saved).toEqual(before);
  });
  it('previews explicit Tranche C 350m to 400m while preserving other tranches', () => {
    const saved = snapshot();
    saved.deal_workspace?.tranches.push({ id: 'c', label: 'C', currency: 'USD', amount: 350000000, rateType: 'fixed', values: {} });
    const plan = prepareCommand(saved, { edits: [{ tranche: 'C', field: 'size', before: '350m', after: '400m' }] });
    expect(plan.after.deal_workspace?.tranches[2].amount).toBe(400000000);
    expect(saved.deal_workspace?.tranches[2].amount).toBe(350000000);
    expect(plan.after.deal_workspace?.tranches[0].amount).toBe(500000000);
  });
  it('returns a normal no-approval result for an AI-planned unchanged 10yr tenor', () => {
    const saved = snapshot();
    try {
      prepareCommand(saved, { edits: [{ tranche: 'B', field: 'tenor', before: '10yr', after: '10yr' }] });
      throw new Error('Expected unchanged result');
    } catch (error) {
      expect(unchangedCommandResult(error)).toMatchObject({ status: 'unchanged', humanExecuteRequired: false });
    }
    expect(saved.notes?.notes).toContain('<<HASH>>old');
  });
  it('does not treat stale or invalid commands as successful no-ops', () => {
    expect(unchangedCommandResult(new Error('Deal changed; request a fresh preview.'))).toBeNull();
    expect(unchangedCommandResult(new Error('Amount must be positive.'))).toBeNull();
  });
  it('previews only the changed entries in a mixed unchanged/changed command', () => {
    const plan = prepareCommand(snapshot(), { edits: [
      { tranche: 'B', field: 'tenor', before: '10yr', after: '10yr' },
      { tranche: 'B', field: 'size', before: '500m', after: '600m' },
    ] });
    expect(plan.effects.some(e => e.location.endsWith('· Tenor'))).toBe(false);
    expect(plan.after.deal_workspace?.tranches[1].amount).toBe(600000000);
  });
  it('recognizes repeated 600m as no change without invalidating existing Terms', () => {
    const saved = snapshot();
    if (!saved.deal_workspace) throw new Error('Missing workspace');
    saved.deal_workspace.tranches[0].amount = 600000000;
    for (const path of COMMAND_FIELDS.size) saved.bdt_state.f[path] = '600000000';
    const before = structuredClone(saved);
    const request = parseDirectCommand('make Tranche A size 600m', saved);
    if (!request) throw new Error('Missing command');
    expect(() => prepareCommand(saved, request)).toThrow(NoCommandChanges);
    expect(saved).toEqual(before);
    expect(saved.notes?.notes).toContain('<<HASH>>old');
  });
  it('still previews inconsistent BDT amounts even when the tranche already shows 600m', () => {
    const saved = snapshot();
    if (!saved.deal_workspace) throw new Error('Missing workspace');
    saved.deal_workspace.tranches[0].amount = 600000000;
    const request = parseDirectCommand('make Tranche A size 600m', saved);
    if (!request) throw new Error('Missing command');
    const plan = prepareCommand(saved, request);
    expect(plan.effects.filter(e => e.location.includes('All fields'))).toHaveLength(2);
    for (const path of COMMAND_FIELDS.size) expect(plan.after.bdt_state.f[path]).toBe('600000000');
  });
  it('previews make Tranche A size 600m using the saved before value without changing it', () => {
    const saved = snapshot();
    const request = parseDirectCommand('make Tranche A size 600m', saved);
    expect(request?.edits[0]).toEqual({ tranche: 'A', field: 'size', before: '500000000', after: '600m' });
    if (!request) throw new Error('Missing command');
    expect(prepareCommand(saved, request).after.deal_workspace?.tranches[0].amount).toBe(600000000);
    expect(saved.deal_workspace?.tranches[0].amount).toBe(500000000);
  });
  it('does not invent membership or a tranche when its saved structure is missing', () => {
    const saved = snapshot(); saved.deal_workspace = null;
    expect(() => parseDirectCommand('make Tranche A size 600m', saved)).toThrow('Save its deal structure first');
  });
  it('previews Tranche A 500m to 600m everywhere without applying it', () => {
    const before = snapshot();
    const request = parseDirectCommand('change Tranche A size from 500m to 600m everywhere');
    expect(request).not.toBeNull();
    if (!request) throw new Error('Missing command');
    const plan = prepareCommand(before, request);
    expect(before.deal_workspace?.tranches[0].amount).toBe(500000000);
    expect(plan.after.deal_workspace?.tranches[0].amount).toBe(600000000);
    for (const path of COMMAND_FIELDS.size) expect(plan.after.bdt_state.f[path]).toBe('600000000');
    expect(plan.after.deal_workspace?.tranches[1].amount).toBe(500000000);
    expect(plan.after.deal_workspace?.aggregateUsd).toBe(2000000000);
    expect(plan.after.deal_workspace?.plannedTotals?.USD).toBe(2000000000);
    expect(plan.effects.some(e => e.location.includes('All fields') && e.after === '600000000')).toBe(true);
  });
  it('preserves manual Terms and legal notices but invalidates the draft', () => {
    const plan = prepareCommand(snapshot(), { edits: [{ tranche: 'B', field: 'size', before: '500m', after: '600m' }] });
    expect(plan.after.notes?.notes).toBe('Manually edited terms\n<<HASH>>\n<<LEGAL>>\nVerbatim legal notice');
    expect(plan.after.bdt_state).toEqual(plan.before.bdt_state);
  });
  it('rejects stale 500m before values when A is already 600m', () => {
    const s = snapshot(); if (s.deal_workspace) s.deal_workspace.tranches[0].amount = 600000000;
    expect(() => prepareCommand(s, { edits: [{ tranche: 'A', field: 'size', before: '500m', after: '600m' }] })).toThrow('not 500m');
  });
  it('updates only the named tranche tenor, leaving maturity unchanged', () => {
    const plan = prepareCommand(snapshot(), { edits: [{ tranche: 'B', field: 'tenor', before: '10yr', after: '12yr' }] });
    expect(plan.after.deal_workspace?.tranches[1].tenor).toBe('12yr');
    expect(plan.after.deal_workspace?.tranches[0].tenor).toBe('5yr');
    expect(plan.after.bdt_state.f[COMMAND_FIELDS.maturity[0]]).toBeUndefined();
  });
  it('saves suggested Terms only in the preview, preserving legal text', () => {
    const s = snapshot();
    const p = prepareCommand(s, { edits: [], bulletin: 'Sasol – Tranche A EUR 500m; Tranche B USD 500m.' });
    expect(s.notes?.notes).toContain('Manually edited terms');
    expect(p.after.notes?.notes).toContain('Sasol – Tranche A EUR 500m; Tranche B USD 500m.');
    expect(p.after.notes?.notes).toContain('Verbatim legal notice');
  });
  it('rejects unsupported commands rather than guessing', () => {
    expect(parseDirectCommand('execute')).toBeNull();
    expect(() => prepareCommand(snapshot(), { edits: [{ tranche: 'A', field: 'sendEmail', before: '', after: 'yes' }] })).toThrow('Unsupported');
    expect(() => prepareCommand(snapshot(), { edits: [{ tranche: 'A', field: 'size', before: '500m', after: 'six hundred' }] })).toThrow('numeric amount');
  });
  it('changing A to fixed clears floating terms and sets the BDT interest type', () => {
    const s = snapshot(); s.bdt_state.f[COMMAND_FIELDS.spread[0]] = '125';
    const p = prepareCommand(s, { edits: [{ tranche: 'A', field: 'rateType', before: 'floating', after: 'fixed' }] });
    expect(p.after.deal_workspace?.tranches[0].rateType).toBe('fixed');
    expect(p.after.bdt_state.f['IssuanceDataGroup/Product/InterestPayment/InterestType']).toBe('FIXED');
    expect(p.after.bdt_state.f[COMMAND_FIELDS.spread[0]]).toBeUndefined();
  });
  it('borrower changes are deal-wide and preserve the legal-name entry exactly', () => {
    const p = prepareCommand(snapshot(), { edits: [{ tranche: 'deal', field: 'borrower', before: 'Sasol Financing USA LLC', after: 'New Legal Issuer LLC' }] });
    expect(p.after.bdt_state.parties?.[0].PartyName).toBe('New Legal Issuer LLC');
    expect(() => prepareCommand(snapshot(), { edits: [{ tranche: 'A', field: 'borrower', before: 'Sasol Financing USA LLC', after: 'New Legal Issuer LLC' }] })).toThrow('deal-wide');
  });
});