/**
 * Digital Term Sheet — DLT view. All logic comes from src/lib/termsheet/dlt.js.
 * Reads the conventional record and writes only state.dlt.
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Deal } from '@/types/bond';
import { refreshAuto } from '@/lib/termsheet/index.js';
import {
  DLT_FIELDS, DLT_ROLES, DLT_E, dltDefault, buildDLTXML, buildToken, dltChecks, dltDiffRows,
} from '@/lib/termsheet/dlt.js';
import { dealToBdtState, type BdtState } from '@/lib/bdt-bridge';

type Dlt = ReturnType<typeof dltDefault>;
interface Props { deal: Deal; canEdit: boolean; onSave: (patch: Partial<Deal>) => void }
const NONE = '__none__';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function TermSheetDlt({ deal, canEdit, onSave }: Props) {
  const [state, setState] = useState<BdtState>(() => dealToBdtState(deal));
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setState(dealToBdtState(deal)); setDirty(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [deal.id]);

  const st = state as BdtState & { dlt?: Dlt };
  const d: Dlt = { ...dltDefault(), ...(st.dlt ?? {}) };
  const setDlt = (patch: Partial<Dlt>) => {
    setState(s => ({ ...s, dlt: { ...dltDefault(), ...((s as { dlt?: Dlt }).dlt ?? {}), ...patch } }));
    setDirty(true);
  };

  // Outputs run on a copy so the DLT view never mutates the conventional record.
  const view = useMemo(() => {
    const c = JSON.parse(JSON.stringify({ ...st, dlt: d }));
    refreshAuto(c);
    if (!d.model) return null;
    return { xml: buildDLTXML(c) as string, token: JSON.stringify(buildToken(c), null, 2), checks: dltChecks(c) as { q: string; l: string; lv: string; msg: string }[], diff: dltDiffRows(c) as string[][], id: c.f['DocumentInformation/DocumentId'] || 'termsheet' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const save = () => { onSave({ bdtState: state }); setDirty(false); toast.success('DLT view saved'); };
  const passed = view ? view.checks.filter(c => c.lv === 'pass').length : 0;

  const card = (key: 'native' | 'twin', title: string, body: string) => (
    <button type="button" disabled={!canEdit} onClick={() => setDlt({ model: key })}
      className={`text-left rounded-lg border p-5 transition-colors ${d.model === key ? 'border-primary bg-primary/10' : 'border-border/70 bg-card/60 hover:border-primary/50'}`}>
      <div className={`text-base font-semibold ${d.model === key ? 'text-primary' : ''}`}>{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-lg font-semibold">DLT view</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            The same deal expressed as a bond on a distributed ledger. The conventional term sheet stays the master record; this view converts it into BDT 2.0 XML with the DLT platform group and a token descriptor a tokenisation platform can map. Question numbers follow the ICMA DLT Bonds Reference Guide (December 2024).
          </p>
        </div>
        {canEdit && <Button size="sm" onClick={save} disabled={!dirty}><Save className="h-4 w-4 mr-1" />Save</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {card('native', 'DLT-native bond', 'The token is the security. No global note or depositary; holdings are recorded on the platform.')}
        {card('twin', 'Digital twin', 'The ICSD global note stays the legal security. The ledger mirrors it and the ICSD record is definitive.')}
      </div>

      {!view ? (
        <div className="rounded-lg border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          Choose DLT-native bond or Digital twin above to start.
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <section className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-2">
                <h3 className="text-sm font-semibold">Role of DLT <span className="text-[10px] text-muted-foreground ml-1">Q1</span></h3>
                {(DLT_ROLES as string[][]).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox disabled={!canEdit} checked={d.roles.includes(k)}
                      onCheckedChange={c => setDlt({ roles: c ? [...d.roles, k] : d.roles.filter(r => r !== k) })} />
                    {label}
                  </label>
                ))}
              </section>
              {(DLT_FIELDS as [string, (string | null)[][]][]).map(([sec, rows]) => (
                <section key={sec} className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-4">
                  <h3 className="text-sm font-semibold">{sec}</h3>
                  {rows.map(([key, label, type, opts, q, hint]) => {
                    const k = key as keyof Dlt; const value = String(d[k] ?? '');
                    const set = (v: string) => setDlt({ [k]: v } as Partial<Dlt>);
                    return (
                      <div key={key} className="grid gap-1.5 sm:grid-cols-[52px_1fr]">
                        <span className="text-[11px] font-mono text-primary pt-2">{q ? `Q${q}` : ''}</span>
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">{label}</div>
                          {type === 'sel' ? (
                            <Select value={value || NONE} disabled={!canEdit} onValueChange={v => set(v === NONE ? '' : v)}>
                              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Not set" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>Not set</SelectItem>
                                {((DLT_E as Record<string, string[]>)[opts as string] ?? []).map(o => <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : type === 'bool' ? (
                            <label className="flex h-9 items-center gap-2 text-sm">
                              <Checkbox disabled={!canEdit} checked={value === 'true'} onCheckedChange={c => set(c ? 'true' : 'false')} />{value === 'true' ? 'Yes' : 'No'}
                            </label>
                          ) : type === 'ta' ? (
                            <Textarea rows={3} disabled={!canEdit} value={value} onChange={e => set(e.target.value)} className="text-sm" />
                          ) : (
                            <Input disabled={!canEdit} value={value} onChange={e => set(e.target.value)} className="h-9 text-sm" />
                          )}
                          {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>

            <aside className="space-y-5 lg:sticky lg:top-4 self-start">
              <section className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Readiness</h3>
                  <span className="text-xs text-muted-foreground">{passed} of {view.checks.length}</span>
                </div>
                <Progress value={view.checks.length ? (passed / view.checks.length) * 100 : 0} className="h-1.5" />
                <ul className="space-y-2">
                  {view.checks.map(c => (
                    <li key={c.q + c.l} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${c.lv === 'pass' ? 'bg-emerald-500' : c.lv === 'fail' ? 'bg-destructive' : 'bg-amber-500'}`} />
                        <span className="font-mono text-muted-foreground">{c.q}</span>
                        <span>{c.l}</span>
                      </div>
                      {c.lv !== 'pass' && <p className="ml-4 text-muted-foreground">{c.msg}</p>}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground/70">Advisory only. These never block a conventional release.</p>
              </section>
              <section className="rounded-lg border border-border/70 bg-card/60 p-4">
                <h3 className="text-sm font-semibold mb-2">What changes from the conventional record</h3>
                <table className="w-full text-xs">
                  <thead><tr className="text-muted-foreground text-left"><th className="py-1 pr-2"></th><th className="py-1 pr-2">Conventional</th><th className="py-1">DLT</th></tr></thead>
                  <tbody>
                    {view.diff.map(([k, a, b]) => (
                      <tr key={k} className="border-t border-border/50 align-top">
                        <td className="py-1.5 pr-2 font-medium">{k}</td><td className="py-1.5 pr-2 text-muted-foreground">{a}</td><td className="py-1.5">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <label className="flex items-start gap-2 rounded-lg border border-border/70 bg-card/60 p-4 text-sm">
                <Checkbox className="mt-0.5" disabled={!canEdit} checked={!!d.include} onCheckedChange={c => setDlt({ include: !!c })} />
                Send the DLT view with each release, alongside the standard term sheet
              </label>
            </aside>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {[
              { t: 'BDT 2.0 XML with DLT group', body: view.xml, file: `${view.id}.dlt.xml`, type: 'application/xml' },
              { t: 'Token descriptor', body: view.token, file: `${view.id}.token.json`, type: 'application/json' },
            ].map(p => (
              <section key={p.t} className="rounded-lg border border-border/70 bg-card/60 p-4 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold flex-1">{p.t}</h3>
                  <Button size="sm" variant="outline" onClick={() => download(p.file, p.body, p.type)}><Download className="h-3.5 w-3.5 mr-1" />Download</Button>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(p.body); toast.success('Copied'); }}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
                </div>
                <pre className="max-h-[480px] overflow-auto rounded-md bg-background/60 p-3 text-[11px] leading-relaxed">{p.body}</pre>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
