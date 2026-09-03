import { useMemo } from 'react';
import type { Deal } from '@/types/bond';
import {
  validateDeal, countBySeverity, type ValidationResult, type Severity,
} from '@/lib/bondValidator';

export type DealCheckFlag = 'red' | 'amber' | 'green';

export interface DealCheckSummary {
  results: ValidationResult[];
  counts: Record<Severity, number>;
  flag: DealCheckFlag;
  label: string;
}

export function summariseResults(results: ValidationResult[]): DealCheckSummary {
  const counts = countBySeverity(results);
  const flag: DealCheckFlag = counts.error > 0 ? 'red' : counts.warning > 0 ? 'amber' : 'green';
  const label =
    flag === 'red'
      ? `Deal Checker: ${counts.error} error${counts.error > 1 ? 's' : ''}`
      : flag === 'amber'
      ? `Deal Checker: ${counts.warning} warning${counts.warning > 1 ? 's' : ''}`
      : 'Deal Checker: all checks passed';
  return { results, counts, flag, label };
}

/**
 * Runs the Deal Checker continuously against a live deal record, from creation
 * through to pricing and settlement. Pure client-side computation — re-runs
 * whenever the deal record changes.
 */
export function useDealChecker(deal: Deal | undefined | null): DealCheckSummary {
  return useMemo(() => {
    if (!deal) return summariseResults([]);
    const { results } = validateDeal(deal, undefined, deal.stage);
    return summariseResults(results);
  }, [deal]);
}
