import { describe, expect, it } from 'vitest';
import { emptyState } from '@/lib/termsheet/index.js';
import { P, type BdtState } from '@/lib/bdt-bridge';
import { termSheetView } from '@/lib/termSheetView';

describe('View follows the authoritative working term sheet', () => {
  it('reflects accepted document fields and subsequent edits without saving', () => {
    const state = emptyState() as BdtState;
    state.f = { [P.currency]: 'USD', [P.totalAmount]: '500000000', [P.coupon]: '4.5', [P.issueDate]: '2026-10-10', [P.maturityDate]: '2031-10-10', [P.benchmarkTicker]: 'UST 5Y' };
    state.parties = [{ PartyName: 'Al Rajhi Sukuk Limited', LEIIdentifier: '', Roles: ['ISSUER'], Ratings: [] }, { PartyName: 'JPMorgan', LEIIdentifier: '', Roles: ['JOINT_BOOKRUNNER'], Ratings: [] }];
    expect(termSheetView(state)).toMatchObject({ issuerName: 'Al Rajhi Sukuk Limited', currency: 'USD', size: 'USD 500m', coupon: '4.5%', tenor: '5Y', benchmark: 'UST 5Y', bookrunners: [{ name: 'JPMorgan', role: 'active', isGlobalCoordinator: false }] });
    state.f[P.coupon] = '5';
    expect(termSheetView(state).coupon).toBe('5%');
  });

  it('cleared values stay empty rather than retaining saved cache values', () => {
    const state = emptyState() as BdtState;
    state.f[P.coupon] = '4.5';
    expect(termSheetView(state).coupon).toBe('4.5%');
    state.f[P.coupon] = '';
    expect(termSheetView(state).coupon).toBe('');
    expect(termSheetView(state).issuerName).toBe('');
    expect(termSheetView(state).bookrunners).toEqual([]);
  });

  it('reads shared fields missing from the legacy deal cache', () => {
    const state = emptyState() as BdtState;
    state.f = { [P.issuanceType]: 'PROGRAMME_NOTE', [P.legalTitleForm]: 'REGISTERED', [P.seniority]: 'SENIOR', [P.secured]: 'UNSECURED', [P.subordinated]: 'UNSUBORDINATED', [P.bizDay]: 'FOLLOWING', [P.optionality]: 'CALLABLE', 'IssuanceDataGroup/Product/ESGLabel': 'GREEN' };
    expect(termSheetView(state)).toMatchObject({ issuanceType: 'PROGRAMME_NOTE', formOfNote: 'REGISTERED', statusOfNote: 'SENIOR / UNSUBORDINATED / UNSECURED', businessDayConvention: 'FOLLOWING', optionality: 'CALLABLE', taxonomy: 'GREEN' });
  });
});