import { describe, expect, it } from 'vitest';
import { shortBorrowerName } from '@/lib/borrowerName';

describe('shortBorrowerName', () => {
  it('shows the Al Rajhi borrower without the bond description', () => {
    expect(shortBorrowerName('Al Rajhi Bank – Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk')).toBe('Al Rajhi Bank');
  });
  it('preserves hyphens within borrower names', () => {
    expect(shortBorrowerName('Rolls-Royce Holdings')).toBe('Rolls-Royce Holdings');
  });
});