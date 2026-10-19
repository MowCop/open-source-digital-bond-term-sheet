import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Info, Loader2, RefreshCw, Shield, Sparkles, Wand2, X, XCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { tallyChecks, unifiedChecks, type BdtState, type CheckItem, type CheckLevel } from '@/lib/bdt-bridge';
import { validLEI } from '@/lib/termsheet/index.js';
import { OPENFIGI_REGULATIONS_URL, OPENFIGI_SEARCH_URL, figiChecks, lookupFigis, reportingChecks, type FigiRecord } from '@/lib/openfigi';
import { checkFix, checkKey, checkTarget, type CheckTarget } from '@/lib/checkActions';
import { toast } from 'sonner';
import { listDealDocuments, DOCS_CHANGED } from '@/lib/dealDocuments';
import { loadAudit, runDeepAudit, type AuditRun } from '@/lib/deepAudit';
import { askCopilot, publishLiveChecks, toLiveChecks } from '@/lib/copilot/liveChecks';
import { AI_MODELS, useAiModel } from '@/lib/aiModel';
import { FIELDS } from '@/lib/termsheet/index.js';
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

  const [audit, setAudit] = useState<AuditRun | null>(null);
  const [auditStep, setAuditStep] = useState('');
  const [aiModel] = useAiModel();
  useEffect(() => { setAudit(dealId ? loadAudit(dealId) : null); }, [dealId]);
  const runAudit = async () => {
    if (!dealId || auditStep) return;
    setOpen(true); setAuditStep('Starting Deep Audit…');
    try {
      const r = await runDeepAudit(dealId, state, setAuditStep);
      setAudit(r);
      const n = r.findings.length;
      if (n) toast.warning(`Deep Audit: ${n} AI warning${n > 1 ? 's' : ''} added to the Deal Checker`, {
        description: 'AI findings are always warnings, never fails. They are included in the amber warning count — look for the AI badge.',
        duration: 8000,
      });
      else toast.success('Deep Audit: no discrepancies found');
    } catch (e) { toast.error(`Deep Audit failed — ${e instanceof Error ? e.message : 'unknown error'}`); }
    finally { setAuditStep(''); }
  };
  const aiChecks = useMemo<CheckItem[]>(() => !audit ? [] : audit.findings.length === 0
    ? [{ l: 'pass', t: 'AI Deep Audit: no discrepancies found', d: `Documents compared with term sheet fields on ${new Date(audit.at).toLocaleString()}.`, src: 'ai' }]
    : audit.findings.map(f => ({
      l: 'warn', src: 'ai', t: f.title,
      d: [f.detail, f.currentValue && `Term sheet: ${f.currentValue}`, f.docValue && `Document: ${f.docValue}`, f.docQuote && `"${f.docQuote}"`].filter(Boolean).join(' · '),
      ai: { fieldPath: f.fieldPath, docValue: f.docValue, docQuote: f.docQuote },
    })), [audit]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiTarget = (c: CheckItem): CheckTarget | null => {
    const path = c.ai?.fieldPath; if (!path) return null;
    const fd = (FIELDS as any[]).find(f => f.p === path);
    return fd ? { kind: 'field', path, sec: fd.sec } : null;
  };
  const targetOf = (c: CheckItem) => (c.src === 'ai' ? aiTarget(c) : checkTarget(c));

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
    return [...base, ...live, ...missing, ...figi, ...aiChecks] as CheckItem[];
  }, [state, refreshTick, leiParties, gleif, noLeiKey, matchCounts, figiRec, isin, storedDocs, aiChecks]);
  const ignoredSet = useMemo(() => new Set(ignored), [ignored]);
  // Share the exact results the user sees with Deal Co-Pilot (read-only).
  useEffect(() => { if (dealId) publishLiveChecks(dealId, toLiveChecks(checks, c => ignoredSet.has(checkKey(c)))); }, [dealId, checks, ignoredSet]);
  const active = useMemo(() => checks.filter(c => c.l !== 'warn' || !ignoredSet.has(checkKey(c))), [checks, ignoredSet]);
  const ignoredCount = checks.length - active.length;
  const tally = useMemo(() => tallyChecks(active), [active]);
  const visible = filter === 'all' ? active : active.filter(check => check.l === filter);
  const tryFix = async (c: CheckItem) => {
    if (c.src === 'ai') {
      const t = aiTarget(c);
      if (c.ai?.docValue && c.ai.fieldPath && onFix?.(s => ({ ...s, f: { ...s.f, [c.ai!.fieldPath]: c.ai!.docValue } }))) {
        toast.success(`Set to "${c.ai.docValue}" from the document — review and save the term sheet`);
      } else toast.info(t ? 'No unambiguous document value — opened the field so you can review it' : 'No single field to open for this finding');
      if (t) onNavigate?.(t);
      return;
    }
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
      {/* px-3 aligns the shield with the drop-zone and Term Sheet icons. */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        <Shield className={`h-4 w-4 shrink-0 ${accent}`} />
        <span className="text-sm font-semibold uppercase tracking-wider">Deal Checker</span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="img"
                tabIndex={0}
                aria-label="About Deal Checker"
                className="inline-flex text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <Info className="h-4 w-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[380px] whitespace-normal break-words space-y-2 text-left text-xs font-normal leading-relaxed">
              <p>
                <strong>Deal Checker</strong> runs a fixed list of written rules over
                this term sheet: every mandatory term present, dates and coupon maths
                consistent, and identifier formats valid — with LEI and FIGI confirmed
                against their official registers. The same terms always give the same
                answer, instantly, and every result is reproducible for audit.
              </p>
              <p>
                It measures whether the term sheet is <strong>complete and
                well-formed</strong>, and can say a term sheet is wrong. The Deal
                Co-Pilot is separate: an AI second opinion on whether the terms match
                what your documents actually say, which can only warn, never decide.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {gleifBusy && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Checking GLEIF…
          </span>
        )}

        {auditStep && <span className="flex animate-pulse items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3" /> {auditStep}</span>}
        {!auditStep && dealId && <span className="text-[11px] text-muted-foreground">{audit ? `Deep Audit ${new Date(audit.at).toLocaleString()}` : 'Deep Audit not run'}</span>}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Badge variant="outline" className={LEVEL_META.pass.badgeClass} title="Green — checks that met every rule. No action needed.">{tally.pass} pass</Badge>
          <Badge variant="outline" className={LEVEL_META.warn.badgeClass} title="Amber — checks worth reviewing: possible issues, missing optional values or items to confirm against documents. Never blocks the deal.">{tally.warn} warn</Badge>
          <Badge variant="outline" className={LEVEL_META.fail.badgeClass} title="Red — checks that broke a hard rule, such as invalid identifiers or missing mandatory terms. Must be fixed before the deal is ready.">{tally.fail} fail</Badge>
          <Button
            type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs"
            disabled={!dealId || storedDocs === 0 || !!auditStep}
            onClick={runAudit}
            title={storedDocs === 0 ? 'Attach deal documents to run the Deep Audit' : 'Compare stored documents against the term sheet fields with Claude'}
          >
            {auditStep ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Run Deep Audit
            <span className="text-[10px] text-muted-foreground">{AI_MODELS.find(m => m.id === aiModel)?.label.replace('Claude ', '')}</span>
          </Button>
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
          {(['all', 'pass', 'warn', 'fail'] as const).map(level => {
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
              const target = onNavigate ? targetOf(check) : null;
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
                  {check.src === 'ai' && (
                    <Badge variant="outline" className="h-5 shrink-0 gap-1 px-1.5 text-[10px]"><Sparkles className="h-3 w-3" /> AI</Badge>
                  )}
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
                      <Button type="button" size="sm" variant="outline" className="h-6 shrink-0 gap-1 px-2 text-[11px]" onClick={() => tryFix(check)} title={check.src === 'ai' ? (check.ai?.docValue ? `Set to "${check.ai.docValue}"` : 'Open the field to review') : checkFix(check, state)?.label ?? 'Open the field to fix it'}>
                        <Wand2 className="h-3 w-3" /> Try to fix
                      </Button>
                      {dealId && <Button type="button" size="sm" variant="outline" className="h-6 shrink-0 gap-1 px-2 text-[11px]" title="Ask Deal Co-Pilot to explain this and propose an evidenced fix for approval" onClick={() => askCopilot(dealId, check)}>
                        <Bot className="h-3 w-3" /> Ask Co-Pilot
                      </Button>}
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