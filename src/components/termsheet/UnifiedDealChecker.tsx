import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Shield, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { tallyChecks, unifiedChecks, type BdtState, type CheckItem, type CheckLevel } from '@/lib/bdt-bridge';

const LEVEL_META: Record<CheckLevel, {
  label: string;
  icon: typeof CheckCircle2;
  badgeClass: string;
  iconClass: string;
}> = {
  pass: {
    label: 'Pass',
    icon: CheckCircle2,
    badgeClass: 'border-emerald-500/50 text-emerald-500',
    iconClass: 'text-emerald-500',
  },
  warn: {
    label: 'Warning',
    icon: AlertTriangle,
    badgeClass: 'border-amber-500/50 text-amber-500',
    iconClass: 'text-amber-500',
  },
  fail: {
    label: 'Fail',
    icon: XCircle,
    badgeClass: 'border-destructive/60 text-destructive',
    iconClass: 'text-destructive',
  },
};

interface Props {
  state: BdtState;
}

export default function UnifiedDealChecker({ state }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<CheckLevel | 'all'>('all');
  const [refreshTick, setRefreshTick] = useState(0);

  const checks = useMemo<CheckItem[]>(() => {
    try {
      return unifiedChecks(state);
    } catch {
      return [];
    }
  }, [state, refreshTick]);
  const tally = useMemo(() => tallyChecks(checks), [checks]);
  const visible = filter === 'all' ? checks : checks.filter(check => check.l === filter);
  const accent = tally.fail > 0
    ? 'text-destructive'
    : tally.warn > 0
      ? 'text-amber-500'
      : 'text-emerald-500';

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Shield className={`h-4 w-4 shrink-0 ${accent}`} />
        <span className="text-sm font-semibold uppercase tracking-wider">Deal Checker</span>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Badge variant="outline" className={LEVEL_META.pass.badgeClass}>{tally.pass} pass</Badge>
          <Badge variant="outline" className={LEVEL_META.warn.badgeClass}>{tally.warn} warn</Badge>
          <Badge variant="outline" className={LEVEL_META.fail.badgeClass}>{tally.fail} fail</Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Refresh Deal Checker"
            title="Refresh Deal Checker"
            onClick={() => setRefreshTick(value => value + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              aria-label={open ? 'Hide check details' : 'Show check details'}
            >
              {open ? 'Hide details' : 'Show details'}
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent className="border-t border-border px-4 py-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['all', 'fail', 'warn', 'pass'] as const).map(level => {
            const count = level === 'all' ? checks.length : tally[level];
            const label = level === 'all' ? 'All' : LEVEL_META[level].label;
            return (
              <Button
                key={level}
                type="button"
                size="sm"
                variant={filter === level ? 'secondary' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setFilter(level)}
              >
                {label} ({count})
              </Button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            No checks in this category.
          </div>
        ) : (
          <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
            {visible.map((check, index) => {
              const meta = LEVEL_META[check.l];
              const Icon = meta.icon;
              return (
                <div key={`${check.l}-${check.t}-${index}`} className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-xs">
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.iconClass}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{check.t}</div>
                    {check.d && <div className="mt-0.5 text-muted-foreground">{check.d}</div>}
                  </div>
                  {check.src === 'vdr' && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">calendar &amp; market rules</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}