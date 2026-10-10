import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Loader2, RefreshCw, Shield, Wand2, X, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { tallyChecks, unifiedChecks, type BdtState, type CheckItem, type CheckLevel } from '@/lib/bdt-bridge';
import { validLEI } from '@/lib/termsheet/index.js';
import { OPENFIGI_REGULATIONS_URL, OPENFIGI_SEARCH_URL, figiChecks, lookupFigis, reportingChecks, type FigiRecord } from '@/lib/openfigi';
import { checkFix, checkKey, checkTarget, type CheckTarget } from '@/lib/checkActions';
import { toast } from 'sonner';
import { listDealDocuments, DOCS_CHANGED } from '@/lib/dealDocuments';
import { GLEIF_ACCESS_URL, GLEIF_SEARCH_URL, gleifCheck, lookupLeis, missingLeiCheck, searchLeiByName, type GleifRecord } from '@/lib/gleif';

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
  dealId?: string;
  onNavigate?: (t: CheckTarget) => void;
  onFix?: (fn: (s: BdtState) => BdtState) => boolean;
  onDocFix?: (c: CheckItem) => string[];
}

const ignoreKey = (id: string) => `vdr.checker.ignored.${id}`;

export default function UnifiedDealChecker({ state, dealId, onNavigate, onFix, onDocFix }: Props) {
  const [ignored, setIgnored] = useState<string[]>([]);
  useEffect(() => {
    if (!dealId) return;
    try { setIgnored(JSON.parse(localStorage.getItem(ignoreKey(dealId)) ?? '[]')); } catch { setIgnored([]); }
  }, [dealId]);
  const saveIgnored = (next: string[]) => {
    setIgnored(next);
    if (dealId) localStorage.setItem(ignoreKey(dealId), JSON.stringify(next));
  };
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<CheckLevel | 'all'>('all');
  const [refreshTick, setRefreshTick] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [gleif, setGleif] = useState<Record<string, GleifRecord>>({});
  const [gleifBusy, setGleifBusy] = useState(false);

  // Parties whose LEI already passes the instant offline check — only these go to GLEIF.
  const leiParties = useMemo(
    () => (state.parties ?? [])
      .map((p: { PartyName?: string; LEIIdentifier?: string }) => ({ name: p.PartyName ?? '', lei: (p.LEIIdentifier ?? '').trim().toUpperCase() }))
      .filter(p => p.lei && validLEI(p.lei)),
    [state.parties],
  );
  const leiKey = leiParties.map(p => p.lei).sort().join(',');

  useEffect(() => {
    if (!leiKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setGleifBusy(true);
      try {
        const res = await lookupLeis(leiKey.split(','));
        if (!cancelled) setGleif(prev => ({ ...prev, ...res }));
      } catch {
        if (!cancelled) setGleif(prev => {
          const next = { ...prev };
          for (const l of leiKey.split(',')) next[l] = { found: false, error: 'GLEIF service unreachable' };
          return next;
        });
      } finally {
        if (!cancelled) setGleifBusy(false);
      }
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [leiKey, refreshTick]);

  // Named parties with no LEI: count GLEIF name matches so the checker can point at the suggestions.
  const noLeiKey = (state.parties ?? [])
    .filter((p: { PartyName?: string; LEIIdentifier?: string }) => (p.PartyName ?? '').trim().length >= 2 && !(p.LEIIdentifier ?? '').trim())
    .map((p: { PartyName?: string }) => (p.PartyName ?? '').trim())
    .join('|');
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!noLeiKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const names = noLeiKey.split('|');
      const res = await Promise.all(names.map(n => searchLeiByName(n)));
      if (!cancelled) setMatchCounts(Object.fromEntries(names.map((n, i) => [n, res[i].length])));
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [noLeiKey]);

  const isin = ((state.ids ?? []).find((x: { Type?: string }) => x.Type === 'ISIN')?.Value ?? '').trim().toUpperCase();
  const [figiRec, setFigiRec] = useState<Record<string, FigiRecord>>({});
  useEffect(() => {
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try { const r = await lookupFigis([isin]); if (!cancelled) setFigiRec(prev => ({ ...prev, ...r })); }
      catch { if (!cancelled) setFigiRec(prev => ({ ...prev, [isin]: { found: false, error: 'OpenFIGI service unreachable' } })); }
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isin, refreshTick]);

  const [storedDocs, setStoredDocs] = useState(0);
  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    const load = () => listDealDocuments(dealId).then(d => { if (!cancelled) setStoredDocs(d.length); }).catch(() => {});
    load();
    const on = (e: Event) => { if ((e as CustomEvent).detail === dealId) load(); };
    window.addEventListener(DOCS_CHANGED, on);
    return () => { cancelled = true; window.removeEventListener(DOCS_CHANGED, on); };
  }, [dealId, refreshTick]);

  const checks = useMemo<CheckItem[]>(() => {
    let base: CheckItem[] = [];
    try {
      base = unifiedChecks(state);
    } catch {
      base = [];
    }
    // Files saved in the deal's Documents store count as attached.
    if (storedDocs > 0) base = base.map(c => c.t === 'No deal documents attached'
      ? { l: 'pass', t: `${storedDocs} deal document${storedDocs > 1 ? 's' : ''} stored`, d: 'Saved in this deal\'s Documents tab.' } as CheckItem
      : c);
    const live = leiParties
      .map(p => gleifCheck(p.name, p.lei, gleif[p.lei]))
      .filter((c): c is CheckItem => !!c)
      .map(c => ({ ...c, src: 'gleif' as const }));
    const missing = (noLeiKey ? noLeiKey.split('|') : [])
      .map(n => missingLeiCheck(n, matchCounts[n] ?? 0))
      .filter((c): c is CheckItem => !!c)
      .map(c => ({ ...c, src: 'gleif' as const }));
    const figi = [...figiChecks(state, figiRec[isin]), ...reportingChecks(state)].map(c => ({ ...c, src: 'openfigi' as const }));
    return [...base, ...live, ...missing, ...figi] as CheckItem[];
  }, [state, refreshTick, leiParties, gleif, noLeiKey, matchCounts, figiRec, isin]);
  const ignoredSet = useMemo(() => new Set(ignored), [ignored]);
  const active = useMemo(() => checks.filter(c => c.l !== 'warn' || !ignoredSet.has(checkKey(c))), [checks, ignoredSet]);
  const ignoredCount = checks.length - active.length;
  const tally = useMemo(() => tallyChecks(active), [active]);
  const visible = filter === 'all' ? active : active.filter(check => check.l === filter);
  const tryFix = async (c: CheckItem) => {
    // Documents already saved to the deal can fill the Documentation list.
    if (/deal documents/i.test(c.t) && dealId) {
      try {
        const stored = await listDealDocuments(dealId);
        if (stored.length) {
          const ok = onFix?.(s => {
            const cur = ((s as unknown as { docs?: Record<string, string>[] }).docs ?? []).filter(d => d.DocumentName);
            const add = stored.filter(d => !cur.some(x => x.DocumentName === d.name)).map(d => ({
              DocumentName: d.name, DocumentDate: d.created_at.slice(0, 10),
              DocumentLink: `vdr://deal-documents/${d.path}`, DocumentVersion: '',
            }));
            return { ...s, docs: [...cur, ...add] } as BdtState;
          });
          if (ok) {
            toast.success(`Added ${stored.length} saved document${stored.length > 1 ? 's' : ''} — review and save the term sheet`);
            const target = checkTarget(c);
            if (target) onNavigate?.(target);
            return;
          }
        }
      } catch { /* fall through to the normal path */ }
    }
    const fix = checkFix(c, state);
    const target = checkTarget(c);
    if (fix && onFix?.(fix.apply)) {
      toast.success(`${fix.label} — review and save the term sheet`);
      if (target) onNavigate?.(target);
      return;
    }
    const fromDoc = onDocFix?.(c) ?? [];
    if (fromDoc.length) {
      toast.success(`Filled from the dropped file — ${fromDoc.join('; ').slice(0, 160)}. Review and save the term sheet`);
      if (target) onNavigate?.(target);
      return;
    }
    if (fix) { toast.error('Fix not applied — the term sheet is read-only here'); return; }
    if (target) { onNavigate?.(target); toast.info('No automatic fix for this one — opened the field so you can fix it'); }
    else toast.info('No automatic fix and no single field to open for this check');
  };
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
        {gleifBusy && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Checking GLEIF…
          </span>
        )}

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
            onClick={() => {
              setRefreshTick(value => value + 1);
              setOpen(true);
              setSpinning(true);
              setTimeout(() => setSpinning(false), 800);
              toast.info('Deal Checker re-run');
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
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
          {ignoredCount > 0 && (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => saveIgnored([])}>
              {ignoredCount} ignored · Restore
            </Button>
          )}
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
              const target = onNavigate ? checkTarget(check) : null;
              return (
                <div key={`${check.l}-${check.t}-${index}`} className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-xs">
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.iconClass}`} />
                  <div className="min-w-0 flex-1">
                    {target ? (
                      <button
                        type="button"
                        onClick={() => onNavigate?.(target)}
                        className="text-left font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                        title="Go to this field"
                      >
                        {check.t}
                      </button>
                    ) : (
                      <div className="font-medium text-foreground">{check.t}</div>
                    )}
                    {check.d && <div className="mt-0.5 text-muted-foreground">{check.d}</div>}
                  </div>
                  {check.src === 'vdr' && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">calendar &amp; market rules</span>
                  )}
                  {(check.src as string) === 'gleif' && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">live GLEIF</span>
                  )}
                  {check.src === 'openfigi' && (
                    <>
                      <span className="shrink-0 text-[10px] text-muted-foreground">OpenFIGI</span>
                      <a
                        href={check.d?.match(/BBG[A-Z0-9]{9}/)?.[0] ? OPENFIGI_SEARCH_URL + check.d.match(/BBG[A-Z0-9]{9}/)![0] : OPENFIGI_REGULATIONS_URL}
                        target="_blank" rel="noreferrer" className="shrink-0 text-primary hover:underline" title="Open in OpenFIGI"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </>
                  )}
                  {check.src !== 'openfigi' && /LEI/.test(check.t) && (
                    <a
                      href={(check.d?.match(/[A-Z0-9]{20}/)?.[0] ? GLEIF_SEARCH_URL + check.d.match(/[A-Z0-9]{20}/)![0] : GLEIF_ACCESS_URL)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-primary hover:underline"
                      title="Open in GLEIF"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {check.l !== 'pass' && (
                    <>
                      <Button type="button" size="sm" variant="outline" className="h-6 shrink-0 gap-1 px-2 text-[11px]" onClick={() => tryFix(check)} title={checkFix(check, state)?.label ?? 'Open the field to fix it'}>
                        <Wand2 className="h-3 w-3" /> Try to fix
                      </Button>
                      {check.l === 'warn' && <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label="Ignore this warning" title="Ignore this warning" onClick={() => saveIgnored([...ignored, checkKey(check)])}>
                        <X className="h-3.5 w-3.5" />
                      </Button>}
                    </>
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