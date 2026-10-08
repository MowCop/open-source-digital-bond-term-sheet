/**
 * Digital Term Sheet — Fill tab.
 *
 * Built directly on the vendored ICMA BDT 2.0 core (src/lib/termsheet/), which
 * is never modified. Rules that hold here:
 *  • `bdtState` is authoritative. The flat deal columns are a derived cache
 *    written on save via `bdtToDealCache` and never edited directly.
 *  • The Priority Execution Layer selects FIELDS entries BY PATH. There is
 *    exactly one definition of every field.
 *  • Validation comes from `unifiedChecks` — one list, core checks first,
 *    VDR calendar/settlement/benchmark rules appended.
 *  • Fixed-rate single tranche only in this iteration.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronDown, ChevronRight,
  Plus, Save, Search, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Deal } from '@/types/bond';
import { docxFileToHtml } from '@/lib/docxToHtml';
import { pdfFileToHtml } from '@/lib/pdfToHtml';
import { stripHtml } from '@/lib/htmlText';
import {
  FIELDS, SECTIONS, GROUPS, STAGES, filled, fieldError, refreshAuto,
  ingestBDT, ingestText,
} from '@/lib/termsheet/index.js';
import {
  bdtStageForDeal, bdtToDealCache, dealToBdtState, priorityFields,
  unifiedChecks, tallyChecks, type BdtState, type CheckItem,
} from '@/lib/bdt-bridge';
import LeiSuggest from './LeiSuggest';
import FigiSuggest from './FigiSuggest';
import TermSheetField, { optionsFor, prettyEnum, type FieldDef } from './TermSheetField';

interface Props {
  deal: Deal;
  canEdit: boolean;
  onSave: (patch: Partial<Deal>) => void;
  onStateChange?: (state: BdtState) => void;
}

interface Proposal {
  kind: 'field' | 'group';
  p?: string;
  g?: string;
  l: string;
  val: string;
  cur: string;
  src: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}

const clone = (s: BdtState): BdtState => JSON.parse(JSON.stringify(s));

interface StageSnap { version: number; stage: number; released_at: string; released_by_name: string | null; bdt_state_snapshot: BdtState }

export interface TermSheetFillHandle {
  /** Parse dropped/picked documents into proposed values; resolves with the count found. */
  ingestFiles: (files: FileList | File[] | null) => Promise<number>;
}

const TermSheetFill = forwardRef<TermSheetFillHandle, Props>(function TermSheetFill(
  { deal, canEdit: canEditProp, onSave, onStateChange }: Props,
  ref,
) {
  const [snaps, setSnaps] = useState<StageSnap[]>([]);
  const [viewStage, setViewStage] = useState<number | null>(null);
  const loadSnaps = async () => {
    const { data } = await supabase.from('deal_term_sheet_releases')
      .select('version,stage,released_at,released_by_name,bdt_state_snapshot')
      .eq('deal_id', deal.id).order('version', { ascending: false });
    setSnaps((data ?? []) as unknown as StageSnap[]);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setViewStage(null); loadSnaps(); }, [deal.id]);
  // Latest snapshot saved while the deal was at (or before) the chosen stage.
  const viewSnap = viewStage == null ? null
    : snaps.find(s => s.stage === viewStage) ?? null;
  const canEdit = canEditProp && viewStage == null;
  const [liveState, setState] = useState<BdtState>(() => dealToBdtState(deal));
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ parties: true });
  const [proposals, setProposals] = useState<Proposal[]>([]);

  // Term sheet steps with no matching deal stage (IPT, Allocated) can be chosen as the save step.
  const BETWEEN_STAGES = [2, 6];

  // Re-seed when the deal identity changes (never mid-edit). A stage saved as an
  // in-between step (IPT/Allocated) is kept; any other stale stored stage snaps back.
  useEffect(() => {
    setState(s => {
      const seeded = dealToBdtState(deal);
      const base = bdtStageForDeal(deal.stage);
      const ok = seeded.stage === base
        || (BETWEEN_STAGES.includes(seeded.stage) && seeded.stage === base + 1);
      return ok ? seeded : { ...seeded, stage: base };
    });
    setDirty(false);
    setProposals([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  // The BDT stage follows the deal's lifecycle stage — but only when the deal's
  // stage actually changes. Without the ref guard this effect also runs on mount
  // and wipes a saved in-between step (IPT/Allocated) on every tab remount.
  const prevDealStage = useRef(deal.stage);
  useEffect(() => {
    if (prevDealStage.current === deal.stage) return;
    prevDealStage.current = deal.stage;
    setState(s => (s.stage === bdtStageForDeal(deal.stage) ? s : { ...s, stage: bdtStageForDeal(deal.stage) }));
  }, [deal.stage]);

  const state: BdtState = viewSnap ? { ...viewSnap.bdt_state_snapshot, stage: viewStage as number } : liveState;
  const liveStage = liveState.stage;
  const baseStage = bdtStageForDeal(deal.stage);
  const canPickStep = (n: number) => canEditProp && n === baseStage + 1 && BETWEEN_STAGES.includes(n);
  const pickStep = (n: number) => { setViewStage(null); setState(st => ({ ...st, stage: n })); setDirty(true); };
  const stageIdx = state.stage;
  const checkItems: CheckItem[] = useMemo(() => {
    try { return unifiedChecks(state); } catch { return []; }
  }, [state]);
  const tally = useMemo(() => tallyChecks(checkItems), [checkItems]);

  useEffect(() => {
    onStateChange?.(liveState);
  }, [liveState, onStateChange]);

  const requiredNow = useMemo(
    () => FIELDS.filter((f: FieldDef) => f.req && f.req <= stageIdx),
    [stageIdx],
  );
  const requiredDone = requiredNow.filter((f: FieldDef) => filled(state, f)).length;
  const pct = requiredNow.length ? Math.round((requiredDone / requiredNow.length) * 100) : 100;

  // ── mutation helpers ────────────────────────────────────────────────────────

  const setField = (p: string, v: string) => {
    setState(s => {
      const next = clone(s);
      next.f[p] = v;
      refreshAuto(next);
      return next;
    });
    setDirty(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mutateGroup = (g: string, fn: (rows: any[]) => any[]) => {
    setState(s => {
      const next = clone(s);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[g] = fn(((next as any)[g] ?? []) as any[]);
      refreshAuto(next);
      return next;
    });
    setDirty(true);
  };

  const valueOf = (p: string) => state.f?.[p] ?? '';
  const isRequired = (fd: FieldDef) => !!fd.req && fd.req <= stageIdx;
  const proposedPaths = useMemo(() => new Set(proposals.filter(p => p.p).map(p => p.p as string)), [proposals]);

  // ── assisted fill ───────────────────────────────────────────────────────────

  async function handleFiles(files: FileList | File[] | null): Promise<number> {
    if (!files?.length) return 0;
    if (!canEdit) {
      toast.info('Return to the current stage before adding documents');
      return 0;
    }
    try {
      const found: Proposal[] = [];
      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase();
        if (name.endsWith('.xml')) {
          const xml = await file.text();
          const out = ingestBDT(state, xml, file.name);
          if (Array.isArray(out)) found.push(...(out as Proposal[]));
          continue;
        }
        let text = '';
        if (name.endsWith('.pdf')) text = (await pdfFileToHtml(file)).text;
        else if (name.endsWith('.docx')) text = (await docxFileToHtml(file)).text;
        else if (name.endsWith('.html') || name.endsWith('.htm')) text = stripHtml(await file.text());
        else text = await file.text();
        const out = ingestText(state, text.slice(0, 150000), file.name);
        if (Array.isArray(out)) found.push(...(out as Proposal[]));
      }
      setProposals(found);
      toast[found.length ? 'success' : 'info'](
        found.length ? `${found.length} proposals to review` : 'Nothing recognisable found in that document',
      );
      return found.length;
    } catch (err) {
      toast.error(`Could not read that document: ${(err as Error).message}`);
      return 0;
    }
  }

  // The drop panel sits in the deal header above the tabs, so ingest is exposed from here.
  useImperativeHandle(ref, () => ({ ingestFiles: handleFiles }));

  const acceptProposal = (i: number) => {
    const pr = proposals[i];
    if (!pr) return;
    if (pr.kind === 'group' && pr.g) mutateGroup(pr.g, () => pr.payload ?? []);
    else if (pr.p) setField(pr.p, pr.val);
    setProposals(list => list.filter((_, n) => n !== i));
  };
  const ignoreProposal = (i: number) => setProposals(list => list.filter((_, n) => n !== i));
  const acceptAll = () => {
    setState(s => {
      const next = clone(s);
      for (const pr of proposals) {
        if (pr.kind === 'group' && pr.g) (next as unknown as Record<string, unknown>)[pr.g] = pr.payload ?? [];
        else if (pr.p) next.f[pr.p] = pr.val;
      }
      refreshAuto(next);
      return next;
    });
    setDirty(true);
    setProposals([]);
  };

  // ── save ────────────────────────────────────────────────────────────────────

  const save = () => {
    const next = clone(state);
    refreshAuto(next);
    onSave({ ...bdtToDealCache(next), bdtState: next });
    setState(next);
    // Immutable per-stage history row, so earlier stages can be revisited.
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const version = (snaps[0]?.version ?? 0) + 1;
      const { error } = await supabase.from('deal_term_sheet_releases').insert({
        deal_id: deal.id, version, stage: next.stage,
        stage_label: STAGES[next.stage - 1]?.t ?? String(next.stage),
        bdt_state_snapshot: next as never, diff_summary: {} as never,
        checks_summary: tally as never, released_by: u.user?.id ?? null,
        released_by_name: u.user?.email ?? null,
      });
      if (!error) loadSnaps();
    })();
    setDirty(false);
    toast.success('Digital Term Sheet saved');
  };

  // ── field filtering ─────────────────────────────────────────────────────────

  const q = query.trim().toLowerCase();
  const matches = (fd: FieldDef) => !q || fd.l.toLowerCase().includes(q) || fd.p.toLowerCase().includes(q);

  const sectionFields = (secId: string) => {
    const all = FIELDS.filter((f: FieldDef) => f.sec === secId && f.t !== 'group' && matches(f));
    if (showOptional || q) return { shown: all, hidden: 0 };
    const shown = all.filter((f: FieldDef) => isRequired(f) || filled(state, f) || proposedPaths.has(f.p));
    return { shown, hidden: all.length - shown.length };
  };
  const sectionGroups = (secId: string) =>
    FIELDS.filter((f: FieldDef) => f.sec === secId && f.t === 'group');

  const priority = useMemo(() => priorityFields().filter(matches), [q]);

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Masthead: stage rail, readiness, checks */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((s: { k: string; t: string }, i: number) => {
            const n = i + 1;
            const active = n === stageIdx;
            const done = n < liveStage;
            const hasSnap = snaps.some(x => x.stage === n);
            const clickable = n === liveStage || (n < liveStage && hasSnap) || canPickStep(n) || (n === baseStage && liveStage !== baseStage);
            return (
              <div key={s.k} className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => { if (canPickStep(n) && liveStage !== n) pickStep(n); else if (n === baseStage && liveStage !== baseStage && viewStage == null) pickStep(n); else setViewStage(n === liveStage ? null : n); }}
                  title={canPickStep(n) && liveStage !== n ? `Save this update as ${s.t}` : clickable ? (n === liveStage ? 'Current stage' : `View what was entered at ${s.t}`) : n < liveStage ? 'No saved record for this stage' : undefined}
                  className={[
                    'text-[11px] px-2 py-1 rounded-md border whitespace-nowrap transition-colors',
                    active
                      ? 'border-primary text-primary bg-primary/10 font-medium'
                      : done
                        ? 'border-border/60 text-muted-foreground'
                        : 'border-border/40 text-muted-foreground/50',
                    clickable && !active ? 'hover:border-primary/60 hover:text-foreground cursor-pointer' : '',
                    n === liveStage && !active ? 'ring-1 ring-primary/40' : '',
                    !clickable ? 'cursor-default' : '',
                  ].join(' ')}
                >
                  {n}. {s.t}
                </button>
                {i < STAGES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
              </div>
            );
          })}
        </div>

        {!viewSnap && liveStage !== baseStage && (
          <div className="rounded-md border border-primary/40 px-3 py-1.5 text-xs text-primary">
            Saving as: {STAGES[liveStage - 1]?.t}. The deal's own stage stays the same.
          </div>
        )}
        {viewSnap && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
            <span className="font-medium text-primary">Viewing {STAGES[(viewStage as number) - 1]?.t} (read-only)</span>
            <span className="text-muted-foreground">saved {new Date(viewSnap.released_at).toUTCString().slice(5, 22)} UTC{viewSnap.released_by_name ? ` by ${viewSnap.released_by_name}` : ''}</span>
            <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => setViewStage(null)}>Back to current</Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[200px] flex-1">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Required at this stage: {requiredDone} of {requiredNow.length}
              </span>
              <span className="text-xs font-medium">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
          {canEdit && (
            <Button size="sm" onClick={save} disabled={!dirty}>
              <Save className="h-4 w-4 mr-1" /> {dirty ? 'Save term sheet' : 'Saved'}
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          Fixed-rate single tranche. Floating and zero coupon structures arrive in a later iteration.
        </p>
      </div>


      {/* Proposal review — nothing is applied without acceptance */}
      {proposals.length > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{proposals.length} proposed values</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={acceptAll}>Accept all</Button>
              <Button size="sm" variant="ghost" onClick={() => setProposals([])}>Ignore all</Button>
            </div>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {proposals.map((pr, i) => (
              <div key={`${pr.p ?? pr.g}-${i}`} className="flex items-center gap-3 rounded-md border border-border/50 bg-background/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{pr.l}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    <span className="line-through opacity-60">{pr.cur || 'empty'}</span>
                    <span className="mx-1.5">→</span>
                    <span className="text-foreground">{pr.val}</span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]">{pr.src}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => acceptProposal(i)} title="Accept">
                  <Check className="h-4 w-4 text-emerald-500" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => ignoreProposal(i)} title="Ignore">
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + optional toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search all 197 term sheet fields..."
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Button size="sm" variant={showOptional ? 'secondary' : 'outline'} onClick={() => setShowOptional(v => !v)}>
          {showOptional ? 'Required at this stage only' : 'Show every field'}
        </Button>
      </div>

      {/* Priority Execution Layer — FIELDS entries selected by path */}
      {priority.length > 0 && (
        <section className="rounded-lg border border-primary/30 bg-card/50 p-4">
          <h3 className="text-sm font-semibold mb-1">Execution essentials</h3>
          <p className="text-[11px] text-muted-foreground/70 mb-3">
            The fields a syndicate desk touches on almost every deal. Each one is the same entry as in its full section below.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            {priority.map((fd: FieldDef) => (
              <TermSheetField
                key={`pri-${fd.p}`}
                fd={fd}
                value={valueOf(fd.p)}
                required={isRequired(fd)}
                proposed={proposedPaths.has(fd.p)}
                invalid={fieldError(state, fd)}
                disabled={!canEdit}
                onChange={v => setField(fd.p, v)}
              />
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border/50">
            <GroupEditor
              g="parties"
              rows={state.parties ?? []}
              canEdit={canEdit}
              onChange={fn => mutateGroup('parties', fn)}
            />
          </div>
        </section>
      )}

      {/* Full BDT sections */}
      <div className="space-y-2">
        {SECTIONS.map((sec: { id: string; t: string; n: string }) => {
          const { shown, hidden } = sectionFields(sec.id);
          const groups = sectionGroups(sec.id);
          if (!shown.length && !groups.length) return null;
          const isOpen = open[sec.id] ?? !!q;
          const missing = shown.filter((f: FieldDef) => isRequired(f) && !filled(state, f)).length;
          return (
            <section key={sec.id} className="rounded-lg border border-border/60 bg-card/40">
              <button
                type="button"
                onClick={() => setOpen(o => ({ ...o, [sec.id]: !isOpen }))}
                className="w-full flex items-center gap-2 px-4 py-3 text-left"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium flex-1">{sec.t}</span>
                {missing > 0 && (
                  <Badge variant="outline" className="border-destructive/50 text-destructive text-[10px]">
                    {missing} missing
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground/60">{shown.length + groups.length}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-4">
                  <p className="text-[11px] leading-snug text-muted-foreground/70">{sec.n}</p>
                  {shown.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                      {shown.map((fd: FieldDef) => (
                        <TermSheetField
                          key={fd.p}
                          fd={fd}
                          value={valueOf(fd.p)}
                          required={isRequired(fd)}
                          proposed={proposedPaths.has(fd.p)}
                          invalid={fieldError(state, fd)}
                          disabled={!canEdit}
                          onChange={v => setField(fd.p, v)}
                        />
                      ))}
                    </div>
                  )}
                  {groups.map((fd: FieldDef) => (
                    <GroupEditor
                      key={fd.p}
                      g={fd.g}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      rows={((state as any)[fd.g] ?? []) as any[]}
                      canEdit={canEdit}
                      onChange={fn => mutateGroup(fd.g, fn)}
                    />
                  ))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowOptional(true)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Show {hidden} optional field{hidden === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

    </div>
  );
});

export default TermSheetFill;

// ─── Repeating group editor (parties, identifiers, ratings, documents, contacts) ──

interface GroupProps {
  g: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  canEdit: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (fn: (rows: any[]) => any[]) => void;
}

function GroupEditor({ g, rows, canEdit, onChange }: GroupProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (GROUPS as any)[g];
  if (!def) return null;

  const setCell = (i: number, key: string, v: unknown) =>
    onChange(list => list.map((r, n) => (n === i ? { ...r, [key]: v } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground">{def.t} list</h4>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange(list => [...list, def.init()])}>
            <Plus className="h-3 w-3 mr-1" /> Add {def.t.toLowerCase()}
          </Button>
        )}
      </div>
      {rows.length === 0 && <p className="text-[11px] text-muted-foreground/60">None recorded.</p>}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="rounded-md border border-border/50 bg-background/40 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2">
              {def.fields.map(([key, label, type, enumKey]: [string, string, string, string?]) => {
                if (type === 'roles') {
                  return (
                    <div key={key} className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(row.Roles ?? []).map((r: string, ri: number) => (
                          <Badge key={ri} variant="secondary" className="text-[10px] gap-1">
                            {prettyEnum(r)}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setCell(i, 'Roles', (row.Roles ?? []).filter((_: string, n: number) => n !== ri))}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                        {canEdit && (
                          <Select
                            value=""
                            onValueChange={v => setCell(i, 'Roles', Array.from(new Set([...(row.Roles ?? []), v])))}
                          >
                            <SelectTrigger className="h-6 w-[150px] text-[11px]">
                              <SelectValue placeholder="Add role" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {optionsFor({ e: 'PartyRoleType' }).map(o => (
                                <SelectItem key={o} value={o}>{prettyEnum(o)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                }
                if (type === 'ratings') {
                  const ratings = row.Ratings ?? [];
                  return (
                    <div key={key} className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">{label}</span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px]"
                            onClick={() => setCell(i, 'Ratings', [...ratings, { RatingAgency: '', RatingValue: '', RatingOutlook: '' }])}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add
                          </Button>
                        )}
                      </div>
                      {ratings.map((rt: Record<string, string>, rj: number) => (
                        <div key={rj} className="flex gap-2">
                          <Select
                            value={rt.RatingAgency || undefined}
                            disabled={!canEdit}
                            onValueChange={v => setCell(i, 'Ratings', ratings.map((x: Record<string, string>, n: number) => (n === rj ? { ...x, RatingAgency: v } : x)))}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Agency" /></SelectTrigger>
                            <SelectContent>
                              {optionsFor({ e: 'RatingAgency' }).map(o => <SelectItem key={o} value={o}>{prettyEnum(o)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-8 w-24 text-xs"
                            placeholder="Rating"
                            value={rt.RatingValue ?? ''}
                            disabled={!canEdit}
                            onChange={e => setCell(i, 'Ratings', ratings.map((x: Record<string, string>, n: number) => (n === rj ? { ...x, RatingValue: e.target.value } : x)))}
                          />
                          <Select
                            value={rt.RatingOutlook || undefined}
                            disabled={!canEdit}
                            onValueChange={v => setCell(i, 'Ratings', ratings.map((x: Record<string, string>, n: number) => (n === rj ? { ...x, RatingOutlook: v } : x)))}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Outlook" /></SelectTrigger>
                            <SelectContent>
                              {optionsFor({ e: 'RatingOutlook' }).map(o => <SelectItem key={o} value={o}>{prettyEnum(o)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setCell(i, 'Ratings', ratings.filter((_: unknown, n: number) => n !== rj))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }
                const field = (
                  <TermSheetField
                    key={key}
                    fd={{ p: `${g}.${i}.${key}`, l: label, t: type === 'sel' ? 'sel' : type, e: enumKey }}
                    value={row[key] ?? ''}
                    disabled={!canEdit}
                    invalid={null}
                    onChange={v => setCell(i, key, v)}
                  />
                );
                if (g === 'parties' && key === 'LEIIdentifier') {
                  return [
                    field,
                    <LeiSuggest
                      key={`${key}-suggest`}
                      name={row.PartyName ?? ''}
                      lei={row.LEIIdentifier ?? ''}
                      canEdit={canEdit}
                      onUse={v => setCell(i, 'LEIIdentifier', v)}
                    />,
                  ];
                }
                return field;
              })}
            </div>
            {canEdit && (
              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => onChange(list => list.filter((_, n) => n !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {g === 'ids' && (
        <FigiSuggest rows={rows} canEdit={canEdit} onAdd={v => onChange(list => [...list, { Type: 'FIGI', Value: v }])} />
      )}
    </div>
  );
}
