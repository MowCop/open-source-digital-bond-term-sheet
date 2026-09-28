import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bookrunner, Deal } from '@/types/bond';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Check, ChevronDown, ChevronRight, FileUp, Loader2, Plus, Save, Search, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { docxFileToHtml } from '@/lib/docxToHtml';
import { pdfFileToHtml } from '@/lib/pdfToHtml';
import { toast } from 'sonner';
import {
  FIELDS, LAYERS, TS_STAGES, TSField, Layer, aiToDealPatch, isFilled, isRequiredNow, stageIndex, suggestMaturity, suggestTenor,
} from './fieldConfig';

interface Props {
  deal: Deal;
  canEdit: boolean;
  onSave: (patch: Partial<Deal>) => void;
}

type Draft = Partial<Deal>;
interface Proposal { key: keyof Deal; label: string; current: string; proposed: string; source: string }

const COUPON_TYPES = [
  { value: 'FIXED', label: 'Fixed' },
  { value: 'FLOATING', label: 'Floating / FRN' },
  { value: 'ZERO_COUPON', label: 'Zero' },
];

const str = (v: unknown) => (v == null ? '' : String(v));

export default function TermSheetFill({ deal, canEdit, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>({});
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Record<Layer, boolean>>({ key: true, pricing: false, more: false });
  const [query, setQuery] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [brName, setBrName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const stage = deal.stage;
  const sIdx = stageIndex(stage);

  // Auto-open sections once the deal reaches their stage.
  useEffect(() => {
    setOpen(o => ({
      key: true,
      pricing: o.pricing || sIdx >= stageIndex('Launched'),
      more: o.more,
    }));
  }, [sIdx]);

  const val = (k: keyof Deal) => (k in draft ? draft[k] : deal[k]);
  const set = (k: keyof Deal, v: unknown) => setDraft(d => ({ ...d, [k]: v }));
  const dirty = Object.keys(draft).length > 0;
  const bookrunners = (val('bookrunners') as Bookrunner[]) ?? [];
  const couponType = str(val('interestType')) || 'FIXED';
  const floating = couponType === 'FLOATING';

  const keyReq = FIELDS.filter(f => f.layer === 'key');
  const keyDone = keyReq.filter(f => isFilled(val(f.key))).length + (isFilled(val('coupon')) ? 1 : 0) + (bookrunners.length ? 1 : 0);
  const keyTotal = keyReq.length + 2;
  const missingNow = FIELDS.filter(f => isRequiredNow(f, stage) && !isFilled(val(f.key))).length;

  const q = query.trim().toLowerCase();
  const matches = (f: TSField) => !q || f.label.toLowerCase().includes(q);

  const visibleIn = (layer: Layer) => {
    const all = FIELDS.filter(f => f.layer === layer && matches(f));
    if (showAll || q || layer !== 'more') return { shown: all, hidden: 0 };
    const shown = all.filter(f => isFilled(val(f.key)) || isRequiredNow(f, stage) || proposals.some(p => p.key === f.key));
    return { shown: open.more ? all : shown, hidden: open.more ? 0 : all.length - shown.length };
  };

  const onTenorOrDate = (k: keyof Deal, v: string) => {
    set(k, v);
    const next = { ...deal, ...draft, [k]: v } as Deal;
    const from = next.issueDate || next.settlementDate;
    if ((k === 'tenor' || k === 'issueDate' || k === 'settlementDate') && !isFilled(next.maturityDate)) {
      const m = suggestMaturity(next.tenor, from);
      if (m) set('maturityDate', m);
    }
    if (k === 'maturityDate' && !isFilled(next.tenor)) {
      const t = suggestTenor(v, from);
      if (t) set('tenor', t);
    }
  };

  const handleSave = () => {
    if (!dirty) return;
    onSave(draft);
    setDraft({});
    toast.success('Digital Term Sheet saved', { description: `${Object.keys(draft).length} field(s) updated` });
  };

  // ---------- Document drop -> proposals ----------
  const parseFile = async (file: File) => {
    const name = file.name.toLowerCase();
    let text = '';
    if (name.endsWith('.pdf')) text = (await pdfFileToHtml(file)).text;
    else if (name.endsWith('.docx')) text = (await docxFileToHtml(file)).text;
    else if (name.endsWith('.xml') || name.endsWith('.txt')) {
      const raw = await file.text();
      text = raw.replace(/<\/?([A-Za-z0-9:_-]+)[^>]*>/g, (_m, tag) => ` ${tag}: `).replace(/\s+/g, ' ');
    } else {
      toast.error(`"${file.name}" can't be read`, { description: 'Use PDF, Word (.docx) or XML.' });
      return;
    }
    const clean = text
      .replace(/data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi, ' ')
      .replace(/[A-Za-z0-9+/]{500,}={0,2}/g, ' ')
      .replace(/\s{2,}/g, ' ').trim().slice(0, 150_000);
    if (clean.length < 20) { toast.error('No readable text found in the document'); return; }

    const { data, error } = await supabase.functions.invoke('extract-deal-fields-ai', { body: { text: clean } });
    if (error) throw error;
    const keyTerms = ((data as { keyTerms?: Record<string, string> })?.keyTerms) || {};
    const bks = (data as { bookrunners?: Bookrunner[] })?.bookrunners || [];
    const patch = aiToDealPatch(keyTerms);
    const labelOf = (k: string) => FIELDS.find(f => f.key === k)?.label || (k === 'coupon' ? 'Coupon' : k === 'interestType' ? 'Coupon type' : k);
    const next: Proposal[] = [];
    for (const [k, v] of Object.entries(patch)) {
      const cur = str(val(k as keyof Deal));
      if (cur.trim() !== str(v).trim()) next.push({ key: k as keyof Deal, label: labelOf(k), current: cur, proposed: str(v), source: file.name });
    }
    if (bks.length) {
      const cur = bookrunners.map(b => b.name).join(', ');
      const prop = bks.map(b => b.name).join(', ');
      if (cur !== prop) next.push({ key: 'bookrunners', label: 'Bookrunners', current: cur, proposed: prop, source: file.name });
      (next as (Proposal & { _bks?: Bookrunner[] })[]).at(-1)!._bks = bks;
    }
    setProposals(p => [...p.filter(x => !next.some(n => n.key === x.key)), ...next]);
    if (next.length === 0) toast.info('No new values found', { description: file.name });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setParsing(true);
    try { for (const f of list) await parseFile(f); }
    catch (e: unknown) {
      const status = (e as { context?: { status?: number } })?.context?.status;
      toast.error(status === 429 ? 'AI rate limit, try again shortly' : status === 402 ? 'AI credits exhausted' : 'Could not read the document');
    } finally { setParsing(false); }
  };

  const accept = (p: Proposal) => {
    const withBks = p as Proposal & { _bks?: Bookrunner[] };
    set(p.key, p.key === 'bookrunners' ? withBks._bks : p.proposed);
    setProposals(ps => ps.filter(x => x !== p));
  };
  const ignore = (p: Proposal) => setProposals(ps => ps.filter(x => x !== p));

  // ---------- Rendering helpers ----------
  const fieldShell = (f: { key: keyof Deal; label: string; requiredAt?: TSField['requiredAt'] }, control: React.ReactNode) => {
    const filled = isFilled(val(f.key));
    const req = isRequiredNow(f, stage);
    const proposed = proposals.some(p => p.key === f.key);
    return (
      <div key={String(f.key)} className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{f.label}</span>
          {req && !filled && <span className="text-orange-400" title="Required at this stage">•</span>}
          {filled && <Check className="h-3 w-3 text-emerald-400" aria-label="Filled" />}
          {proposed && <Sparkles className="h-3 w-3 text-primary" aria-label="Value proposed from document" />}
        </div>
        <div className={req && !filled ? 'rounded-md ring-1 ring-orange-500/70' : ''}>{control}</div>
      </div>
    );
  };

  const renderField = (f: TSField, large = false) => {
    const v = str(val(f.key));
    const cls = large ? 'h-10 text-base' : 'h-9 text-sm';
    if (f.type === 'select') {
      return fieldShell(f, (
        <Select value={v || undefined} onValueChange={x => set(f.key, x)} disabled={!canEdit}>
          <SelectTrigger className={cls}><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{f.options!.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      ));
    }
    const isDate = f.type === 'date' && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v));
    return fieldShell(f, (
      <Input
        className={cls}
        type={isDate ? 'date' : 'text'}
        value={v}
        placeholder={f.placeholder}
        disabled={!canEdit}
        onChange={e => ['tenor', 'issueDate', 'settlementDate', 'maturityDate'].includes(f.key as string)
          ? onTenorOrDate(f.key, e.target.value) : set(f.key, e.target.value)}
      />
    ));
  };

  const addBookrunner = () => {
    const n = brName.trim(); if (!n) return;
    set('bookrunners', [...bookrunners, { name: n, role: 'active', isGlobalCoordinator: false }]);
    setBrName('');
  };
  const patchBr = (i: number, p: Partial<Bookrunner>) => set('bookrunners', bookrunners.map((b, j) => (j === i ? { ...b, ...p } : b)));

  const layerHeader = (id: Layer, title: string, note: string, extra?: React.ReactNode) => (
    <button
      type="button"
      onClick={() => id !== 'key' && setOpen(o => ({ ...o, [id]: !o[id] }))}
      className="w-full flex items-center gap-2 text-left"
    >
      {id !== 'key' && (open[id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
      <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
      <span className="text-xs text-muted-foreground hidden sm:inline">— {note}</span>
      <span className="ml-auto">{extra}</span>
    </button>
  );

  const pricing = visibleIn('pricing');
  const more = visibleIn('more');
  const moreGroups = useMemo(() => {
    const g: Record<string, TSField[]> = {};
    more.shown.forEach(f => { (g[f.group || 'Other'] ||= []).push(f); });
    return g;
  }, [more.shown]);

  return (
    <div className="space-y-4">
      {/* Stage rail + readiness */}
      <div className="rounded-lg border bg-card/60 p-3 space-y-3">
        <ol className="flex flex-wrap gap-1">
          {TS_STAGES.map((s, i) => (
            <li key={s} className={`flex-1 min-w-[5.5rem] border-b-2 pb-1 text-xs ${i < sIdx ? 'border-muted-foreground/50 text-muted-foreground' : i === sIdx ? 'border-orange-500 text-foreground font-semibold' : 'border-border text-muted-foreground/60'}`}>
              <span className="font-mono text-[10px] block">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="text-xs">Key terms {keyDone}/{keyTotal}</Badge>
          {missingNow > 0
            ? <Badge variant="outline" className="text-xs border-orange-500/70 text-orange-400">{missingNow} required for {stage}</Badge>
            : <Badge variant="outline" className="text-xs border-emerald-500/60 text-emerald-400">Ready for {stage}</Badge>}
          <div className="relative flex-1 min-w-[10rem] max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a field…" className="h-8 pl-7 text-xs" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Switch id={`all-${deal.id}`} checked={showAll} onCheckedChange={setShowAll} />
            <Label htmlFor={`all-${deal.id}`} className="text-xs">Show every field</Label>
          </div>
        </div>
      </div>

      {/* Document drop */}
      {canEdit && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-lg border border-dashed px-4 py-2.5 flex items-center gap-2 text-xs transition-colors ${dragOver ? 'border-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary/60'}`}
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {parsing ? 'Reading document…' : 'Drop a term sheet here to suggest values (PDF, Word, XML). Nothing is saved until you accept.'}
          <input ref={fileRef} type="file" accept=".pdf,.docx,.xml,.txt" multiple hidden onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
      )}

      {/* Review proposals */}
      {proposals.length > 0 && (
        <div className="rounded-lg border border-primary/50 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Proposed values ({proposals.length})</span>
            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => proposals.forEach(accept)}>Accept all</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setProposals([])}>Ignore all</Button>
          </div>
          <div className="divide-y divide-border/60">
            {proposals.map(p => (
              <div key={String(p.key)} className="grid grid-cols-[8rem_1fr_auto] sm:grid-cols-[10rem_1fr_1fr_auto] items-center gap-2 py-1.5 text-xs">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="hidden sm:block line-through text-muted-foreground truncate">{p.current || '—'}</span>
                <span className="font-medium truncate" title={`From ${p.source}`}>{p.proposed}</span>
                <span className="flex gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" title="Accept" onClick={() => accept(p)}><Check className="h-3.5 w-3.5 text-emerald-400" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Ignore" onClick={() => ignore(p)}><X className="h-3.5 w-3.5" /></Button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layer 1: Key terms */}
      <section className="rounded-lg border bg-card/60 p-4 space-y-4">
        {layerHeader('key', LAYERS[0].title, LAYERS[0].note)}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {keyReq.filter(matches).slice(0, 5).map(f => renderField(f, true))}
          {(!q || 'coupon type'.includes(q)) && fieldShell({ key: 'interestType', label: 'Coupon type' }, (
            <ToggleGroup type="single" value={couponType} onValueChange={v => v && canEdit && set('interestType', v)} className="justify-start" variant="outline">
              {COUPON_TYPES.map(c => <ToggleGroupItem key={c.value} value={c.value} className="h-10 px-3 text-xs data-[state=on]:border-orange-500 data-[state=on]:text-foreground">{c.label}</ToggleGroupItem>)}
            </ToggleGroup>
          ))}
          {(!q || 'coupon margin'.includes(q)) && (floating
            ? <>
                {fieldShell({ key: 'referenceRate', label: 'Reference rate' }, <Input className="h-10 text-base" value={str(val('referenceRate'))} placeholder="e.g. 3M EURIBOR" disabled={!canEdit} onChange={e => set('referenceRate', e.target.value)} />)}
                {fieldShell({ key: 'coupon', label: 'Margin over reference', requiredAt: 'Priced' }, <Input className="h-10 text-base" value={str(val('coupon'))} placeholder="e.g. +45bp" disabled={!canEdit} onChange={e => set('coupon', e.target.value)} />)}
              </>
            : couponType !== 'ZERO_COUPON' && fieldShell({ key: 'coupon', label: 'Coupon', requiredAt: 'Priced' }, <Input className="h-10 text-base" value={str(val('coupon'))} placeholder="e.g. 3.250%" disabled={!canEdit} onChange={e => set('coupon', e.target.value)} />)
          )}
          {keyReq.filter(matches).slice(5).map(f => renderField(f, true))}
        </div>

        {(!q || 'bookrunners banks'.includes(q)) && fieldShell({ key: 'bookrunners', label: 'Bookrunners (banks)', requiredAt: 'Mandate' }, (
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border bg-background/40">
            {bookrunners.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                {b.name}
                <button type="button" disabled={!canEdit} onClick={() => patchBr(i, { role: b.role === 'active' ? 'passive' : 'active' })}
                  className={`rounded px-1 text-[10px] ${b.role === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-muted text-muted-foreground'}`} title="Toggle Active/Passive">
                  {b.role === 'active' ? 'Active' : 'Passive'}
                </button>
                <button type="button" disabled={!canEdit} onClick={() => patchBr(i, { isGlobalCoordinator: !b.isGlobalCoordinator })}
                  className={`rounded px-1 text-[10px] ${b.isGlobalCoordinator ? 'bg-orange-500/25 text-orange-300' : 'text-muted-foreground/60'}`} title="Toggle Global Coordinator">GC</button>
                {canEdit && <button type="button" onClick={() => set('bookrunners', bookrunners.filter((_, j) => j !== i))} aria-label={`Remove ${b.name}`}><X className="h-3 w-3" /></button>}
              </span>
            ))}
            {canEdit && (
              <span className="inline-flex items-center gap-1">
                <Input value={brName} onChange={e => setBrName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBookrunner(); } }} placeholder="Add bank…" className="h-7 w-36 text-xs" />
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={addBookrunner}><Plus className="h-3.5 w-3.5" /></Button>
              </span>
            )}
          </div>
        ))}
      </section>

      {/* Layer 2: Pricing & execution */}
      <section className="rounded-lg border bg-card/60 p-4 space-y-4">
        {layerHeader('pricing', LAYERS[1].title, LAYERS[1].note)}
        {(open.pricing || showAll || q) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{pricing.shown.map(f => renderField(f))}</div>
        )}
      </section>

      {/* Layer 3: More detail */}
      <section className="rounded-lg border bg-card/60 p-4 space-y-4">
        {layerHeader('more', LAYERS[2].title, LAYERS[2].note,
          more.hidden > 0 && <span className="text-xs text-primary underline-offset-2 hover:underline">Show {more.hidden} optional fields</span>)}
        {Object.entries(moreGroups).map(([g, fs]) => (
          <div key={g} className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground border-b pb-1">{g}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{fs.map(f => renderField(f))}</div>
          </div>
        ))}
      </section>

      {canEdit && (
        <div className="sticky bottom-0 flex justify-end gap-2 py-2 bg-gradient-to-t from-background to-transparent">
          {dirty && <Button variant="ghost" size="sm" onClick={() => setDraft({})}>Discard</Button>}
          <Button size="sm" onClick={handleSave} disabled={!dirty} className="border border-orange-500">
            <Save className="h-4 w-4 mr-1" /> {dirty ? `Save ${Object.keys(draft).length} change(s)` : 'Saved'}
          </Button>
        </div>
      )}
    </div>
  );
}
