import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy, Trash2, ArrowUp, ArrowDown, Plus, Settings2, ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import TranchePanel, { type TrancheSave } from './TranchePanel';
import { useScopedApp } from '@/context/AppContext';
import { dealBorrowerName } from '@/lib/borrowerName';
import { SENIORITY_LABEL } from '@/lib/trancheFields';
import type { Deal } from '@/types/bond';
import {
  type DealWorkspace, type Tranche, fromLegacy, duplicateTranche, newTrancheId,
  aggregateUsdEquivalent, usdEquivalent,
} from '@/lib/dealWorkspace';

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n >= 1e9 ? `${+(n / 1e9).toFixed(3)}bn` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}m` : n.toLocaleString();
const parseAmt = (s: string): number | null => {
  const t = s.replace(/[, ]/g, '').toLowerCase();
  if (!t) return null;
  const m = t.match(/^([\d.]+)(bn|b|m|mm)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2]?.startsWith('b') ? v * 1e9 : m[2] ? v * 1e6 : v;
};
const letter = (i: number) => String.fromCharCode(65 + i);

function initial(deal: Deal): DealWorkspace {
  const raw = (deal as unknown as { dealWorkspace?: DealWorkspace }).dealWorkspace;
  if (raw?.version === 1) return raw;
  const ws = fromLegacy(null, deal.currency || '', parseAmt(deal.size || ''));
  ws.tranches[0].tenor = deal.tenor || '';
  ws.tranches[0].rateType = /float|frn/i.test(deal.interestType || '') ? 'floating' : 'fixed';
  return ws;
}

export default function DealTermSheets({ deal, canEdit, onOpenAllFields, selected, onSelect, onWorkspace }: { deal: Deal; canEdit: boolean; onOpenAllFields: () => void; selected: number; onSelect: (i: number) => void; onWorkspace?: (ws: DealWorkspace) => void }) {
  const [ws, setWs] = useState<DealWorkspace>(() => initial(deal));
  const setSelected = onSelect;
  useEffect(() => { onWorkspace?.(ws); }, [ws, onWorkspace]);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [popped, setPopped] = useState<string | null>(null);
  const { updateDeal } = useScopedApp();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bdt = (deal.bdtState ?? null) as any;
  const main: Record<string, string> = bdt?.f ?? {};

  useEffect(() => {
    if (!expanded || popped) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, popped]);

  const saveTranche = async (t: Tranche, isFirst: boolean, s: TrancheSave) => {
    if (bdt) {
      const changed = Object.keys(s.main).some(k => s.main[k] !== main[k]);
      if (changed) updateDeal(deal.id, { bdtState: { ...bdt, f: s.main }, updatedAt: new Date() });
    }
    const next = { ...ws, tranches: ws.tranches.map(x => x.id === t.id ? { ...x, ...s.details, seniority: s.seniority, values: isFirst ? x.values : s.own } : x) };
    if (!await save(next)) throw new Error('Could not save tranche');
  };

  useEffect(() => {
    let live = true;
    supabase.from('deals').select('deal_workspace').eq('id', deal.id).maybeSingle().then(({ data }) => {
      const w = data?.deal_workspace as unknown as DealWorkspace | null;
      if (live && w?.version === 1) setWs(w);
    });
    return () => { live = false; };
  }, [deal.id]);

  const usd = useMemo(() => usdEquivalent(ws), [ws]);
  const aggregate = useMemo(() => aggregateUsdEquivalent(ws), [ws]);
  const sel = ws.tranches[Math.min(selected, ws.tranches.length - 1)];

  const save = async (next: DealWorkspace) => {
    const { error } = await supabase.from('deals').update({ deal_workspace: next as never }).eq('id', deal.id);
    if (error) { toast.error(`Could not save deal structure: ${error.message}`); return false; }
    setWs(next); toast.success('Deal structure saved'); return true;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Totals</span>
        {Object.entries(ws.plannedTotals).map(([c, v]) => <Badge key={c} variant="outline">{c} {fmt(v)}</Badge>)}
        {Object.keys(ws.plannedTotals).length === 0 && <span className="text-muted-foreground">Not yet determined</span>}
        <span className="text-muted-foreground">
          · Aggregate Total (USD Equiv.): {aggregate != null ? `~USD ${fmt(aggregate)} (indicative)` : '—'}
        </span>
        {canEdit && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditing(true)}><Settings2 className="h-3.5 w-3.5 mr-1" />Deal structure</Button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr><th className="text-left py-1.5">Tranche</th><th className="text-left">Ccy / Amount</th><th className="text-left">USD eq.</th><th className="text-left">Type</th><th className="text-left">Tenor</th><th /></tr>
          </thead>
          <tbody>
            {ws.tranches.map((t, i) => (
              <Fragment key={t.id}>
              <tr onClick={() => setSelected(i)} onDoubleClick={() => setExpanded(expanded === t.id ? null : t.id)} className={`cursor-pointer select-none border-b border-border/50 ${sel?.id === t.id ? 'bg-accent/40' : 'hover:bg-accent/20'}`}>
                <td className="py-1.5 font-medium">{t.label}</td>
                <td>{t.currency || '—'} {fmt(t.amount)}</td>
                <td className="text-muted-foreground">{fmt(usd.perTranche[t.id])}</td>
                <td className="capitalize">{t.rateType} · <span className="text-muted-foreground normal-case">{SENIORITY_LABEL[t.seniority ?? 'senior_unsecured']}</span></td>
                <td>{t.tenor || '—'}</td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={expanded === t.id ? `Collapse tranche ${t.label}` : `Expand tranche ${t.label}`} onClick={e => { e.stopPropagation(); setExpanded(expanded === t.id ? null : t.id); }}>
                    {expanded === t.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </td>
              </tr>
              {expanded === t.id && (
                <tr className="border-b border-border"><td colSpan={6} className="bg-muted/20">
                  <TranchePanel key={t.id + (deal.updatedAt?.toString() ?? '')} tranche={t} isFirst={i === 0} issuer={dealBorrowerName(deal)} main={main} canEdit={canEdit && !!bdt}
                    onSave={s => saveTranche(t, i === 0, s)} onPopOut={() => setPopped(t.id)} />
                </td></tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">Double-click a tranche, or use the arrow at the end of its row, to open its term sheet. Esc closes it.</p>

      {popped && (() => { const i = ws.tranches.findIndex(x => x.id === popped); const t = ws.tranches[i]; if (!t) return null; return (
        <Dialog open onOpenChange={o => { if (!o) setPopped(null); }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="flex-row flex-wrap items-baseline gap-x-6 gap-y-2 space-y-0 pr-8 text-left">
              <DialogTitle>Tranche {t.label} term sheet</DialogTitle>
            </DialogHeader>
            <TranchePanel tranche={t} isFirst={i === 0} issuer={dealBorrowerName(deal)} main={main} canEdit={canEdit && !!bdt} onSave={s => saveTranche(t, i === 0, s)} />
          </DialogContent>
        </Dialog>
      ); })()}

      {editing && <StructureDialog ws={ws} onClose={() => setEditing(false)} onSave={async n => { if (await save(n)) setEditing(false); }} />}
    </div>
  );
}

function StructureDialog({ ws, onClose, onSave }: { ws: DealWorkspace; onClose: () => void; onSave: (w: DealWorkspace) => void }) {
  const [d, setD] = useState<DealWorkspace>(() => {
    const draft = structuredClone(ws);
    const currencies = [...new Set(draft.tranches.map(t => t.currency).filter(Boolean))];
    if (draft.aggregateUsd === undefined && currencies.length === 1 && currencies[0] === 'USD') draft.aggregateUsd = draft.plannedTotals.USD ?? null;
    return draft;
  });
  const set = (tranches: Tranche[]) => setD({ ...d, tranches: tranches.map((t, i) => ({ ...t, label: letter(i) })) });
  const upd = (i: number, p: Partial<Tranche>) => set(d.tranches.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const move = (i: number, dir: -1 | 1) => { const a = [...d.tranches]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a); };
  const remove = (i: number) => {
    if (Object.keys(d.tranches[i].values).length && !confirm(`Tranche ${d.tranches[i].label} has recorded terms. Remove it?`)) return;
    set(d.tranches.filter((_, j) => j !== i));
  };
  const add = () => set([...d.tranches, { id: newTrancheId(), label: '', rateType: d.tranches.at(-1)?.rateType ?? 'fixed', currency: d.tranches.at(-1)?.currency ?? '', amount: null, values: {} }]);
  const ccys = [...new Set(d.tranches.map(t => t.currency).filter(Boolean))];
  const applyAll = (rt: 'fixed' | 'floating') => set(d.tranches.map(t => ({ ...t, rateType: rt })));
  const usd = usdEquivalent(d);

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="sm:flex-row sm:items-center sm:justify-between gap-3 sm:space-y-0 pr-6">
          <DialogTitle>Deal structure</DialogTitle>
          <div className="text-left space-y-1">
            <label htmlFor="aggregate-usd" className="text-sm font-medium">Aggregate Total (USD Equiv.)</label>
            <Input id="aggregate-usd" className="h-8 sm:w-56" placeholder="Optional" defaultValue={d.aggregateUsd ?? ''} onChange={e => setD(current => ({ ...current, aggregateUsd: parseAmt(e.target.value) }))} />
          </div>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <span>Tranches: {d.tranches.length}</span>
            <Button size="sm" variant="outline" onClick={() => applyAll('fixed')}>All fixed</Button>
            <Button size="sm" variant="outline" onClick={() => applyAll('floating')}>All floating</Button>
          </div>

          <div className="overflow-x-auto"><table className="w-full">
            <thead className="text-xs text-muted-foreground"><tr><th className="text-left">Tranche</th><th className="text-left">Rate type</th><th className="text-left">Currency</th><th className="text-left">Amount (optional)</th><th className="text-left">Tenor</th><th /></tr></thead>
            <tbody>
              {d.tranches.map((t, i) => (
                <tr key={t.id}>
                  <td className="pr-2 font-medium">{t.label}</td>
                  <td className="pr-2 py-1">
                    <Select value={t.rateType} onValueChange={v => upd(i, { rateType: v as Tranche['rateType'] })}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="floating">Floating</SelectItem></SelectContent>
                    </Select>
                  </td>
                  <td className="pr-2"><Input className="h-8 w-20" value={t.currency} maxLength={3} onChange={e => upd(i, { currency: e.target.value.toUpperCase() })} /></td>
                  <td className="pr-2"><Input className="h-8 w-36" placeholder="e.g. 500m" defaultValue={t.amount ?? ''} onBlur={e => upd(i, { amount: parseAmt(e.target.value) })} /></td>
                  <td className="pr-2"><Input className="h-8 w-20" value={t.tenor ?? ''} onChange={e => upd(i, { tenor: e.target.value })} /></td>
                  <td className="whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Duplicate" disabled={d.tranches.length >= 10} onClick={() => set([...d.tranches.slice(0, i + 1), duplicateTranche(t, ''), ...d.tranches.slice(i + 1)])}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove" disabled={d.tranches.length <= 1} onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Button size="sm" variant="outline" disabled={d.tranches.length >= 10} onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Add tranche</Button>

          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="font-medium">Exchange rates (manual)</div>
              <span className="text-xs italic text-muted-foreground">Lock source: To be confirmed</span>
            </div>
            {ccys.every(c => c === 'USD') && <div className="text-xs text-muted-foreground">USD / USD: 1</div>}
            {ccys.map(c => (
              c !== 'USD' && <div key={c} className="flex flex-wrap items-center gap-2">
                {c !== 'USD' && (
                  <>
                    <span className="text-xs ml-2">USD per {c}</span>
                    <Input aria-label={`USD per ${c}`} className="h-8 w-24" defaultValue={d.fx[c]?.usdPerUnit ?? ''} onBlur={e => {
                      const v = parseFloat(e.target.value);
                      const fx = { ...d.fx };
                      if (Number.isFinite(v) && v > 0) fx[c] = { usdPerUnit: v, source: 'Entered by banker', asOf: new Date().toISOString(), locked: fx[c]?.locked };
                      else delete fx[c];
                      setD({ ...d, fx });
                    }} />
                    {d.fx[c] && <Button size="sm" variant="ghost" onClick={() => setD({ ...d, fx: { ...d.fx, [c]: { ...d.fx[c], locked: !d.fx[c].locked } } })}>{d.fx[c].locked ? 'Unlock' : 'Lock'}</Button>}
                    {d.fx[c] && <span className="text-xs text-muted-foreground">{d.fx[c].source} · {new Date(d.fx[c].asOf).toLocaleDateString()}</span>}
                  </>
                )}
              </div>
            ))}
            <div className="text-xs text-muted-foreground">
              Allocated tranches (USD equivalent, indicative): {usd.total != null ? fmt(usd.total) : '—'}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(d)}>Save structure</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
