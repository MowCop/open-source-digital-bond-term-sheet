import { describe, it, expect } from 'vitest';
import { canCreateNewDeal, emptyNewDeal, fillEmptyIssuer } from '@/lib/newDeal';

describe('New Deal requirements', () => {
  it('starts with every deal value empty', () => {
    expect(Object.values(emptyNewDeal()).every(value => value === '')).toBe(true);
  });
  it('requires a nonblank issuer', () => {
    expect(canCreateNewDeal(' ', [{ name: 'Bank' }])).toBe(false);
  });
  it('requires at least one explicitly added named bookrunner', () => {
    expect(canCreateNewDeal('Issuer', [])).toBe(false);
    expect(canCreateNewDeal('Issuer', [{ name: ' ' }])).toBe(false);
    expect(canCreateNewDeal('Issuer', [{ name: 'Bank' }])).toBe(true);
  });
  it('allows creation without any optional deal terms', () => {
    const draft = emptyNewDeal();
    draft.issuerName = 'Issuer';
    expect(canCreateNewDeal(draft.issuerName, [{ name: 'Bank' }])).toBe(true);
    expect(draft.size).toBe('');
    expect(draft.currency).toBe('');
  });
  it('accepts multi tranche and multi currency as draft values', () => {
    const draft = { ...emptyNewDeal(), tenor: 'multi tranche', currency: 'multi currency' };
    expect(draft.tenor).toBe('multi tranche');
    expect(draft.currency).toBe('multi currency');
  });
  it('fills an empty issuer from extraction without replacing user input', () => {
    expect(fillEmptyIssuer('', ' Republic of France ')).toBe('Republic of France');
    expect(fillEmptyIssuer('My borrower', 'Republic of France')).toBe('My borrower');
    expect(fillEmptyIssuer('', undefined)).toBe('');
  });
});