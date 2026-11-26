import { termsHash } from './alert-terms.ts';

// Server-only, pure command planner. No model or human approval happens here.
export interface CommandState { f: Record<string, string>; parties?: { PartyName: string; Roles: string[] }[]; [key: string]: unknown }
export interface CommandWorkspace { version: number; tranches: { id: string; label: string; amount: number | null; currency: string; tenor?: string; rateType: string; values: Record<string, unknown> }[]; plannedTotals?: Record<string, number | null>; aggregateUsd?: number | null; fx?: Record<string, { usdPerUnit: number }>; [key: string]: unknown }
export interface CommandSnapshot { bdt_state: CommandState; deal_workspace: CommandWorkspace | null; notes: { intro: string; notes: string } | null }
export interface CommandEdit { tranche: string; field: string; before: string; after: string }
export interface CommandRequest { edits: CommandEdit[]; bulletin?: string }
export interface CommandEffect { location: string; before: string; after: string }
export interface CommandPlan { before: CommandSnapshot; after: CommandSnapshot; effects: CommandEffect[]; warnings: string[]; request: CommandRequest }
export class NoCommandChanges extends Error {
  constructor() { super('The requested values are already set in the saved terms; no changes are needed.'); this.name = 'NoCommandChanges'; }
}
export class CommandValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'CommandValidationError'; }
}
export function commandConversationResult(error: unknown) {
  return unchangedCommandResult(error) ?? (error instanceof CommandValidationError
    ? { status: 'needs_input' as const, message: error.message, humanExecuteRequired: false }
    : null);
}
export function unchangedCommandResult(error: unknown) {
  return error instanceof NoCommandChanges
    ? { status: 'unchanged' as const, message: error.message, humanExecuteRequired: false }
    : null;
}
const I = 'IssuanceDataGroup/Issuance/';
const P = 'IssuanceDataGroup/Product/';
const FIX = P + 'InterestPayment/FixedRatePayment/';
const FLOAT = P + 'InterestPayment/FloatingRatePayment/';
export const COMMAND_FIELDS: Record<string, string[]> = {
  size: [P + 'AggregateNominalAmount/Value', I + 'TotalAggregateAmount/Value'],
  currency: [I + 'SpecifiedCurrency', P + 'AggregateNominalAmount/Currency'],
  coupon: [FIX + 'InterestRate'], maturity: [P + 'Maturity/MaturityDate'],
  settlement: [I + 'SettlementDate'], pricingDate: [I + 'PricingDate'],
  price: [I + 'IssuePrice/Value'], reofferPrice: [I + 'ReofferPrice/Value'],
  yield: [I + 'ReofferYield/Value'], benchmark: [FLOAT + 'Benchmark/BenchmarkCode'],
  spread: [FLOAT + 'Spread/Value'], guidance: ['x:guidance'], ipt: ['x:iptSpread'],
  governingLaw: [I + 'GoverningLaw/CountryCode'],
  priceTalk: ['x:priceTalk'], yieldTalk: ['x:yieldTalk'], sizeIndication: ['x:sizeIndication'],
  dealSize: ['x:sizeMsg'], skew: ['x:sizeSkew'], usdEquivalent: ['x:usdEquivalent'], spreadConvention: ['x:spreadConvention'],
};
/** Whole-deal entries (tranche "deal"). */
export const DEAL_FIELDS = ['borrower', 'governingLaw', 'dealSize', 'skew', 'usdEquivalent', 'spreadConvention'];
const TEXT_FIELDS = ['priceTalk', 'yieldTalk', 'sizeIndication', 'dealSize', 'skew', 'guidance', 'ipt'];
export const COMMAND_TOOL = {
  name: 'prepareUpdates',
  description: 'Prepare a grouped command preview for HUMAN Execute; never executes. Read saved workspace first. Supports size, currency, tenor, rateType, coupon, maturity, settlement, pricingDate, price, reofferPrice, yield, benchmark, spread, guidance, ipt, priceTalk, yieldTalk (talk wording verbatim, e.g. 4.50% +/- 5bp WPIR), sizeIndication (qualitative tranche size, e.g. Benchmark), governingLaw, borrower, dealSize (Benchmark / Target USD 1bn / WNG wording), skew (e.g. Skewed to the long end), usdEquivalent (numeric total), spreadConvention (MS/UST/BENCHMARK). Specify tranche label A/B/etc, or deal for borrower/governingLaw/dealSize/skew/usdEquivalent/spreadConvention. Map tenor references like \"the 10s\" to the tranche with that tenor. before is the exact current value, empty if absent (size may use 500m). after is explicitly requested. Optional bulletin is whole-deal Send Update Terms text, not legal notices. Unknown or ambiguous commands must be clarified, never guessed. Do not also call proposeChange for these updates.',
  input_schema: { type: 'object', properties: {
    edits: { type: 'array', items: { type: 'object', properties: { tranche: { type: 'string' }, field: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' } }, required: ['tranche', 'field', 'before', 'after'], additionalProperties: false } },
    bulletin: { type: 'string' },
  }, required: ['edits'], additionalProperties: false },
};

export function commandAmount(s: string) {
  const m = s.trim().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*(m|mm|million|bn|b|billion)?$/i);
  if (!m) throw new CommandValidationError('Use a numeric amount, for example 500m or 600000000.');
  const n = Number(m[1]) * (/^(bn|b|billion)$/i.test(m[2] ?? '') ? 1e9 : m[2] ? 1e6 : 1);
  if (!Number.isFinite(n) || n <= 0) throw new CommandValidationError('Amount must be positive.');
  return String(n);
}
export function commandTargetAmount(current: string, requested: string, label = 'Deal size'): string {
  if (Number(current) >= 1e6 && /^\d+(?:\.\d+)?$/.test(requested.trim()) && Number(requested) > 0 && Number(requested) < 1e6) {
    throw new CommandValidationError(`${label}: “${requested}” has no amount unit. Please specify ${requested}m, ${requested}bn, or the full numeric amount. No changes were applied.`);
  }
  return commandAmount(requested);
}
/** Source units must agree with the extracted value; never repair a missing multiplier by guessing. */
export function evidencedCommandAmount(value: string, quote: string): string | null {
  try {
    const normalized = commandAmount(value);
    const explicit = [...quote.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\s*(million|billion|bn|mm|m|b)\b/gi)]
      .map(match => commandAmount(match[1] + match[2]));
    return explicit.length && !explicit.includes(normalized) ? null : normalized;
  } catch (error) {
    if (error instanceof CommandValidationError) return null;
    throw error;
  }
}
function canonical(field: string, s: string) {
  s = s.trim();
  if (!s) return '';
  if (field === 'size' || field === 'usdEquivalent') return commandAmount(s);
  if (TEXT_FIELDS.includes(field)) return s.replace(/\s+/g, ' ');
  if (field === 'spreadConvention') { s = s.toUpperCase(); if (!['MS', 'UST', 'BENCHMARK'].includes(s)) throw new Error('Spread convention must be MS, UST or BENCHMARK.'); }
  if (field === 'currency' || field === 'governingLaw') {
    s = s.toUpperCase();
    if (!(field === 'currency' ? /^[A-Z]{3}$/ : /^[A-Z]{2}$/).test(s)) throw new Error('Use the canonical currency or governing-law country code.');
  }
  if (['maturity', 'settlement', 'pricingDate'].includes(field) && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s)) throw new Error('Use a valid date in YYYY-MM-DD format.');
  if (['coupon', 'price', 'reofferPrice', 'yield', 'spread'].includes(field)) {
    s = s.replace(/%$/, '');
    if (!/^-?\d+(?:\.\d+)?$/.test(s)) throw new Error('Use a numeric value without inferred units.');
  }
  if (field === 'rateType' && !['fixed', 'floating'].includes(s.toLowerCase())) throw new Error('Choose fixed or floating.');
  return field === 'rateType' ? s.toLowerCase() : s;
}

const tenorYears = (s: string) => { const m = s.match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : NaN; };
function savedTranches(snapshot?: CommandSnapshot) {
  if (!snapshot) throw new Error('Read the saved DTS before preparing this command.');
  if (!snapshot.bdt_state?.f) throw new CommandValidationError('Save the DTS before preparing commands. No changes were applied.');
  const t = snapshot.deal_workspace?.tranches ?? [];
  if (!t.length) throw new CommandValidationError('There is no saved deal structure. In Deal term sheets, open Deal structure and save the tranche setup, then repeat your command. No changes were applied.');
  return t;
}
const ownValues = (s: CommandSnapshot, i: number) => i === 0 ? s.bdt_state.f : s.deal_workspace!.tranches[i].values as Record<string, string>;
/** Execution phrases: "Size the 10s at 1bn, 30s at 750m", "Skew to the long end", "Deal size 2.5bn USD equivalent", "Guidance tranche B 4.50% +/- 5bp WPIR". */
export function parseExecutionCommand(text: string, snapshot?: CommandSnapshot): CommandRequest | null {
  const t = text.trim().replace(/[.!]$/, '');
  const sizes = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:s|y|yr|year)s?\s+(?:at|to|=)\s*(\d+(?:\.\d+)?\s*(?:m|mm|million|bn|b|billion))/gi)];
  if (/^(?:please\s+)?size\b/i.test(t) && sizes.length) {
    const tr = savedTranches(snapshot);
    return { edits: sizes.map(([, years, amount]) => {
      const i = tr.findIndex(x => tenorYears(x.tenor ?? '') === Number(years));
      if (i < 0) throw new CommandValidationError(`No saved tranche has a ${years}-year tenor. Name the tranche (for example “make Tranche B size 1bn”) or record its tenor first. No changes were applied.`);
      return { tranche: tr[i].label, field: 'size', before: String(tr[i].amount ?? ''), after: amount };
    }) };
  }
  const skew = t.match(/^(?:please\s+)?(?:set\s+)?(?:size\s+)?skew(?:ed)?\s+(?:it\s+)?(?:to\s+)?(?:the\s+)?(.+)$/i);
  if (skew) {
    savedTranches(snapshot);
    const w = skew[1].trim(), after = /^long( end)?$/i.test(w) ? 'Skewed to the long end' : /^short( end)?$/i.test(w) ? 'Skewed to the short end' : /^even(ly)?( split)?$/i.test(w) ? 'Evenly split' : w;
    return { edits: [{ tranche: 'deal', field: 'skew', before: snapshot!.bdt_state.f['x:sizeSkew'] ?? '', after }] };
  }
  const usd = t.match(/^(?:please\s+)?(?:set\s+)?(?:total\s+)?deal size\s+(?:to\s+|at\s+)?(?:usd\s*)?(\d+(?:\.\d+)?\s*(?:m|mm|million|bn|b|billion))\s*(?:usd\s+)?(?:equivalent|equiv\.?)$/i);
  if (usd) { savedTranches(snapshot); return { edits: [{ tranche: 'deal', field: 'usdEquivalent', before: snapshot!.bdt_state.f['x:usdEquivalent'] ?? '', after: usd[1] }] }; }
  const state = t.match(/^(?:please\s+)?(?:set\s+)?(?:total\s+)?deal size\s+(?:to\s+)?((?:benchmark|target|expected|wng|will not grow).*)$/i);
  if (state) { savedTranches(snapshot); return { edits: [{ tranche: 'deal', field: 'dealSize', before: snapshot!.bdt_state.f['x:sizeMsg'] ?? '', after: state[1] }] }; }
  const talk = t.match(/^(?:please\s+)?(?:revise\s+|set\s+|update\s+)?(ipts?|initial price thoughts|guidance|price talk|yield talk)(?:\s+(?:for\s+)?(?:tranche\s+([a-z])|the\s+(\d+)s))?\s*(?:to|at|:)?\s+(.+)$/i);
  if (talk) {
    const tr = savedTranches(snapshot), kind = talk[1].toLowerCase();
    const field = kind.startsWith('ipt') || kind.startsWith('initial') ? 'ipt' : kind === 'guidance' ? 'guidance' : kind === 'price talk' ? 'priceTalk' : 'yieldTalk';
    const i = talk[2] ? tr.findIndex(x => x.label.toUpperCase() === talk[2].toUpperCase()) : talk[3] ? tr.findIndex(x => tenorYears(x.tenor ?? '') === Number(talk[3])) : tr.length === 1 ? 0 : -1;
    if (i < 0) throw new CommandValidationError(talk[2] || talk[3] ? 'That tranche is not in the saved deal structure. No changes were applied.' : `This deal has ${tr.length} tranches. Say which one, for example “${talk[1]} tranche B ${talk[4]}”. No changes were applied.`);
    return { edits: [{ tranche: tr[i].label, field, before: ownValues(snapshot!, i)[COMMAND_FIELDS[field][0]] ?? '', after: talk[4] }] };
  }
  return null;
}

/** Exact single-command fast path; everything else stays with the existing agent. */
export function parseDirectCommand(text: string, snapshot?: CommandSnapshot): CommandRequest | null {
  const m = text.trim().match(/^(?:please\s+)?(?:change|update|set)\s+tranche\s+([a-z])\s+(size|amount|currency|tenor|coupon|maturity|price|rate type)\s+from\s+(.+?)\s+to\s+(.+?)(?:\s+everywhere)?[.!]?$/i);
  if (m) return { edits: [{ tranche: m[1].toUpperCase(), field: m[2].toLowerCase() === 'amount' ? 'size' : m[2].toLowerCase() === 'rate type' ? 'rateType' : m[2].toLowerCase(), before: m[3], after: m[4] }] };
  const multi = parseExecutionCommand(text, snapshot);
  if (multi) return multi;
  const target = text.trim().match(/^(?:please\s+)?(?:make|change|update|set)\s+tranche\s+([a-z])\s+(?:size|amount)\s+(?:(?:to|at|=)\s*)?(\d+(?:\.\d+)?\s*(?:m|mm|million|bn|b|billion)?)(?:\s+everywhere)?[.!]?$/i);
  if (!target) return null;
  if (!snapshot) throw new Error('Read the saved DTS before preparing this command.');
  const label = target[1].toUpperCase();
  const index = snapshot.deal_workspace?.tranches.findIndex(t => t.label.toUpperCase() === label) ?? -1;
  const tranche = snapshot.deal_workspace?.tranches[index];
  if (!tranche) throw new CommandValidationError(`Tranche ${label} is not in the saved deal structure. In Deal term sheets, open Deal structure and save the tranche setup, then repeat your command. No changes were applied.`);
  if (!snapshot.bdt_state?.f) throw new CommandValidationError('Save the DTS before preparing commands. No changes were applied.');
  const own = index === 0 ? snapshot.bdt_state.f : tranche.values;
  const before = String(tranche.amount ?? own[COMMAND_FIELDS.size[0]] ?? '');
  return { edits: [{ tranche: label, field: 'size', before, after: target[2] }] };
}

export function prepareCommand(snapshot: CommandSnapshot, request: CommandRequest): CommandPlan {
  if (!snapshot.bdt_state?.f) throw new CommandValidationError('Save the DTS before preparing commands. No changes were applied.');
  if (!Array.isArray(request.edits) || request.edits.length > 30 || (request.bulletin !== undefined && typeof request.bulletin !== 'string')) throw new Error('Invalid command.');
  if (request.bulletin && request.bulletin.length > 20000) throw new Error('Update draft is too long.');
  const after = structuredClone(snapshot), effects: CommandEffect[] = [], warnings: string[] = [];
  const seen = new Set<string>();
  const add = (location: string, before: unknown, next: unknown) => { if (String(before ?? '') !== String(next ?? '')) effects.push({ location, before: String(before ?? ''), after: String(next ?? '') }); };
  for (const edit of request.edits) {
    if (![edit.tranche, edit.field, edit.before, edit.after].every(v => typeof v === 'string')) throw new Error('Invalid edit.');
    const { field } = edit;
    const dealWide = DEAL_FIELDS.includes(field);
    if (dealWide && edit.tranche.toLowerCase() !== 'deal') throw new Error(`${field} is a deal-wide entry; preview it for the whole deal.`);
    const tranches = after.deal_workspace?.tranches ?? [];
    const index = dealWide ? 0 : tranches.findIndex(t => t.label.toUpperCase() === edit.tranche.toUpperCase());
    if (!dealWide && index < 0) throw new CommandValidationError(`Tranche ${edit.tranche} is not in the saved deal structure. In Deal term sheets, open Deal structure and save the tranche setup, then repeat your command. No changes were applied.`);
    const t = tranches[index];
    const key = `${dealWide ? 'deal' : t.id}:${field}`;
    if (seen.has(key)) throw new Error('Duplicate edits for the same entry are not allowed.');
    seen.add(key);
    const label = dealWide ? 'Whole deal' : `Tranche ${t.label}`;
    const paths = COMMAND_FIELDS[field];
    if (!paths && !['tenor', 'rateType', 'borrower'].includes(field)) throw new Error(`Unsupported field ${field}; no changes prepared.`);
    const own = index === 0 || dealWide ? after.bdt_state.f : t.values;
    const issuer = after.bdt_state.parties?.find(p => p.Roles.includes('ISSUER'));
    const current = field === 'borrower' ? issuer?.PartyName ?? '' : field === 'size' ? t.amount ?? own[paths[0]] ?? '' : field === 'currency' ? t.currency : field === 'tenor' ? t.tenor ?? '' : field === 'rateType' ? t.rateType : own[paths[0]] ?? (field === 'settlement' || field === 'pricingDate' ? after.bdt_state.f[paths[0]] : '') ?? '';
    if (canonical(field, String(current)) !== canonical(field, edit.before)) {
      const bareMillions = field === 'size' && /^\d+(?:\.\d+)?$/.test(edit.before.trim()) && Number(edit.before) * 1e6 === Number(current);
      throw new CommandValidationError(bareMillions
        ? `${label} has a saved size of ${Number(current) / 1e6}m (${current}). “${edit.before}” has no unit and means ${edit.before}, not ${Number(current) / 1e6} million. Please repeat the command with explicit units, for example “change ${label} size from ${Number(current) / 1e6}m to [new amount]m”. No changes were applied.`
        : `${label} ${field} is ${current || 'empty'}, not ${edit.before || 'empty'}. Request a fresh preview. No changes were applied.`);
    }
    const value = field === 'size' && edit.after.trim() ? commandTargetAmount(String(current), edit.after, label) : canonical(field, edit.after);
    if (!value) throw new Error('Clearing entries is not supported by this command; edit the DTS directly.');
    if (field === 'coupon' && t.rateType !== 'fixed') throw new Error('This is a floating-rate tranche; use spread or change its rate type explicitly.');
    if (['spread', 'benchmark'].includes(field) && t.rateType !== 'floating') throw new Error('This is a fixed-rate tranche; change its rate type explicitly first.');
    if (field === 'borrower') {
      if (!issuer) throw new Error('No recorded issuer to update.');
      add('Whole deal · Borrower (headings and all tranche views)', issuer.PartyName, value);
      issuer.PartyName = value; after.bdt_state.deal = value;
      warnings.push('Borrower name changed; verify the legal issuer and its LEI against documentation.');
    } else if (field === 'tenor') { add(`${label} · Tenor`, t.tenor, value); t.tenor = value; warnings.push('Tenor is display metadata; maturity date is unchanged.'); }
    else {
      if (field === 'rateType') {
        add(`${label} · Rate type`, t.rateType, value); t.rateType = value;
        const obsolete = value === 'fixed' ? FLOAT : FIX;
        for (const path of Object.keys(own)) if (path.startsWith(obsolete)) { add(`${label} · Remove inapplicable ${path.split('/').slice(-2).join('/')}`, own[path], ''); delete own[path]; }
        const path = P + 'InterestPayment/InterestType';
        const type = value === 'fixed' ? 'FIXED' : 'FLOATING'; add(`${label} · ${path}`, own[path], type); own[path] = type;
        warnings.push('Rate type changes remove opposite-rate terms; supply and review the new rate terms.');
      } else {
        if (field === 'size') { add(`${label} · Deal term sheets / Ccy–Amount`, t.amount, value); t.amount = Number(value); }
        if (field === 'currency') { add(`${label} · Deal term sheets / Currency`, t.currency, value); t.currency = value; warnings.push('Currency change does not convert the amount or change the benchmark/FX rate.'); }
        if (field === 'usdEquivalent' && after.deal_workspace) { add('Whole deal · Aggregate Total (USD Equiv.)', after.deal_workspace.aggregateUsd, value); after.deal_workspace.aggregateUsd = Number(value); warnings.push('USD equivalent is indicative; check the FX source and time.'); }
        if (['priceTalk', 'yieldTalk', 'ipt', 'guidance', 'dealSize', 'skew', 'sizeIndication'].includes(field)) warnings.push('Talk and size wording stays Open with its prior values kept in the field history until pricing.');
        for (const path of paths) { add(`${label} · ${index === 0 || dealWide ? 'All fields' : 'Tranche terms'} / ${path}`, own[path], value); own[path] = value; }
      }
      // Keep Tranche A's copied field store consistent; other tranches' explicit values are untouched.
      if (index === 0 && t) t.values = { ...t.values, ...after.bdt_state.f };
    }
  }
  if (request.edits.length) {
    warnings.push('View, selected-tranche BDT XML and DLT view will read the updated terms. Published updates, sent emails, source documents and historical snapshots are unchanged.');
    const w = after.deal_workspace;
    if (w && request.edits.some(e => ['size', 'currency'].includes(e.field))) {
      warnings.push('Planned currency totals and the independently entered Aggregate Total (USD Equiv.) remain unchanged; review allocation and FX separately.');
      for (const t of w.tranches) if (t.currency !== 'USD' && !w.fx?.[t.currency]) warnings.push(`No recorded FX rate for ${t.currency}; indicative USD equivalent is unavailable.`);
    }
  }
  const old = snapshot.notes;
  const raw = old?.notes ?? '';
  const legal = raw.split('\n<<LEGAL>>\n')[1] ?? '';
  if (request.bulletin?.trim()) {
    const notes = `${request.bulletin.trim()}\n<<HASH>>${termsHash(after.bdt_state)}${legal ? `\n<<LEGAL>>\n${legal}` : ''}`;
    add('Send Update · Terms draft (legal notices preserved)', raw.split('\n<<HASH>>')[0], request.bulletin.trim());
    after.notes = { intro: '', notes };
    warnings.push('Suggested Terms text is a draft. Execute saves it for review; it never sends email or Bloomberg messages.');
  } else if (effects.length && old) {
    // Invalidate even if only non-A workspace terms changed (not included in legacy BDT hash).
    after.notes = { ...old, notes: raw.replace(/\n<<HASH>>[^\n]*/, '\n<<HASH>>') };
    add('Send Update · Existing Terms draft', 'Current or previously checked', 'Requires regeneration or human re-check');
    warnings.push('Existing Send Update text is preserved and flagged for review, not rewritten.');
  }
  if (!effects.length) throw new NoCommandChanges();
  return { before: snapshot, after, effects, warnings: [...new Set(warnings)], request };
}