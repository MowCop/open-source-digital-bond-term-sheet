import { describe, it, expect } from 'vitest';
import { emptyState } from '@/lib/termsheet/index.js';
import { P, type BdtState } from '@/lib/bdt-bridge';
import { documentProposals, extractedFieldValues } from '@/lib/documentIntake';
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
});