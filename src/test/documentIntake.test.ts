import { describe, it, expect } from 'vitest';
import { emptyState } from '@/lib/termsheet/index.js';
import { P, type BdtState } from '@/lib/bdt-bridge';
import { documentProposals, extractedFieldValues, extractedIdentifiers, extractedRatings } from '@/lib/documentIntake';
import { mergeDocumentFields } from '@/lib/newDeal';
import { termSheetView } from '@/lib/termSheetView';

describe('Additional offering memorandum intake', () => {
  const terms = { Denomination: 'USD 200,000 x 1,000', 'Maturity Date': '23 October 2033', Listing: 'Luxembourg Stock Exchange', 'Day Count': '30E/360', 'Payment Frequency': 'Semi-annual', Seniority: 'Senior unsecured' };
  it('extracts denomination without mistaking integral multiples for denomination', () => {
    expect(extractedFieldValues(terms)[P.denomination]).toBe('200000');
  });
  it('extracts a fully specified maturity date', () => {
    expect(extractedFieldValues(terms)[P.maturityDate]).toBe('2033-10-23');
  });
  it('maps the stated listing to the dictionary venue', () => {
    expect(extractedFieldValues(terms)[P.listingVenue]).toBe('LUXEMBOURG_STOCK_EXCHANGE');
  });
  it('preserves the stated day count without changing 30E to 30', () => {
    expect(extractedFieldValues(terms)[P.dayCount]).toBe('30E/360');
  });
  it('maps stated semi-annual payment frequency', () => {
    expect(extractedFieldValues(terms)[P.couponFreq]).toBe('SEMIANNUALLY');
  });
  it('maps stated seniority without treating security as seniority', () => {
    expect(extractedFieldValues(terms)[P.seniority]).toBe('SENIOR');
  });
  it('leaves missing, provisional and ambiguous values empty', () => {
    expect(extractedFieldValues({ Denomination: 'TBD', 'Maturity Date': '2033', Listing: 'Unknown market', 'Payment Frequency': 'TBA', Seniority: '', 'Day Count': 'not specified', Coupon: 'TBD', Size: 'Benchmark' })).toEqual({});
  });
  it('never changes recorded values while generating proposals', () => {
    const state = emptyState() as BdtState;
    state.f[P.denomination] = '100000';
    const proposals = documentProposals(state, 'Notes issued in denominations of USD 200,000', terms, 'Preliminary OM.txt');
    expect(state.f[P.denomination]).toBe('100000');
    expect(proposals.find(p => p.p === P.denomination)).toMatchObject({ val: '200000', cur: '100000', src: 'Preliminary OM.txt' });
    expect(proposals.filter(p => p.p === P.dayCount)).toHaveLength(1);
  });
  it('preserves user edits and explicitly cleared initial terms', () => {
    expect(mergeDocumentFields({ [P.denomination]: '100000', [P.seniority]: '' }, extractedFieldValues(terms), new Set([P.seniority]))).toMatchObject({ [P.denomination]: '100000', [P.seniority]: '', [P.maturityDate]: '2033-10-23' });
  });
  it('carries accepted initial terms into the same Fill and View record', () => {
    const state = emptyState() as BdtState;
    state.f = extractedFieldValues(terms);
    expect(termSheetView(state)).toMatchObject({ specifiedDenomination: '200000', maturityDate: '2033-10-23', listingVenue: 'LUXEMBOURG_STOCK_EXCHANGE', dayCountFraction: '30E/360', interestPaymentFrequency: 'SEMI_ANNUAL', statusOfNote: 'SENIOR' });
    expect(documentProposals(state, '', terms, 'OM')).toEqual([]);
  });
  it('maps a Frankfurt listing and preserves 30/360', () => {
    const v = extractedFieldValues({ Listing: 'Open Market of the Frankfurt Stock Exchange', 'Day Count': '30/360' });
    expect(v[P.listingVenue]).toBe('FRANKFURT_STOCK_EXCHANGE');
    expect(v[P.dayCount]).toBe('30/360');
  });
  it('rejects an ISIN with a bad check digit and generic identifier wording', () => {
    expect(extractedIdentifiers({ ISIN: 'US0378331006', CUSIP: 'CUSIP, ISIN, Common Code', 'Common Code': 'TBD' })).toEqual([]);
    expect(extractedIdentifiers({ ISIN: 'US0378331005' })).toEqual([{ Type: 'ISIN', Value: 'US0378331005' }]);
  });
  it('ignores rating thresholds and keeps assigned ratings', () => {
    expect(extractedRatings({ Ratings: [{ agency: 'Moody\'s', value: 'Baa3 or better', outlook: '' }] })).toEqual([]);
    expect(extractedRatings({ Ratings: [{ agency: 'S&P', value: 'BB+', outlook: 'Stable' }] })).toEqual([{ RatingAgency: 'SNPG', RatingValue: 'BB+', RatingOutlook: 'STABLE' }]);
  });
  it('proposes guarantor, form, Reg S and call without changing state', () => {
    const state = emptyState() as BdtState;
    const props = documentProposals(state, '', { Guarantor: 'Sasol Limited', 'Form of Note': 'Registered', 'Reg S Category': 'Category 2', Optionality: 'CALL' }, 'OM');
    expect(props.find(p => p.g === 'parties')?.val).toContain('Sasol Limited');
    expect(props.find(p => p.p === P.legalTitleForm)?.val).toBe('REGISTERED');
    expect(props.find(p => p.p?.endsWith('RegSCode'))?.val).toBe('REGS_CAT2');
    expect(props.find(p => p.p === P.optionality)?.val).toBe('CALL');
    expect(state.parties).toEqual([]);
  });
});

describe('document dates are timezone-safe', () => {
  it('keeps "15 March 2030" as 2030-03-15', async () => {
    const { extractedFieldValues } = await import('@/lib/documentIntake');
    const v = Object.values(extractedFieldValues({ 'Maturity Date': '15 March 2030', 'Pricing Date': 'March 1, 2026', 'Settlement Date': '31 February 2026' }));
    expect(v).toContain('2030-03-15');
    expect(v).toContain('2026-03-01');
    expect(v).not.toContain('2026-03-03');
  });
});
