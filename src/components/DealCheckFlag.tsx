import type { Deal } from '@/types/bond';
import { useDealChecker } from '@/hooks/useDealChecker';

const DOT_CLASS: Record<string, string> = {
  red: 'bg-red-500 ring-red-500/30',
  amber: 'bg-amber-400 ring-amber-400/30',
  green: 'bg-green-500 ring-green-500/30',
};

/**
 * Traffic-light indicator for the AI Deal Checker on a live deal.
 * Red = blocking errors, orange = warnings, green = all checks passed.
 */
export default function DealCheckFlag({ deal, className = '' }: { deal: Deal | undefined | null; className?: string }) {
  const { flag, label } = useDealChecker(deal);
  if (!deal) return null;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block h-2.5 w-2.5 rounded-full ring-2 shrink-0 ${DOT_CLASS[flag]} ${className}`}
    />
  );
}
