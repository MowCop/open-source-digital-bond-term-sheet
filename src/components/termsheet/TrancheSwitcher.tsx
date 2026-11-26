import { FieldStatusSummary } from './FieldStatusContext';
import { trancheBdtState } from '@/lib/trancheState';
import { TEMPLATE_LABELS } from '@/lib/fieldStatus';
import type { BdtState } from '@/lib/bdt-bridge';
import { skewWeights } from '@/lib/execution';
import { Button } from '@/components/ui/button';
import type { DealWorkspace } from '@/lib/dealWorkspace';

export default function TrancheSwitcher({ ws, selected, onSelect, note, state }: { ws: DealWorkspace | null; selected: number; onSelect: (i: number) => void; note?: string; state?: BdtState }) {
  const list = ws?.tranches ?? [];
  const t = list[selected];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
      <span className="font-medium">Tranche {t?.label || 'A'}</span>
      {t && <span className="text-muted-foreground">· {[t.currency && t.amount != null ? `${t.currency} ${t.amount >= 1e9 ? `${t.amount / 1e9}bn` : `${t.amount / 1e6}m`}` : t.currency, t.tenor, TEMPLATE_LABELS[t.rateType]].filter(Boolean).join(' · ')}</span>}
      {state&&<FieldStatusSummary state={trancheBdtState(state,ws,selected)}/>}
      {list.length > 1 && state && (() => { const w = skewWeights(ws, state.f['x:sizeSkew'] ?? ''); return <span className="flex h-3 w-20 items-end gap-px" aria-label={`Size weighting${state.f['x:sizeSkew'] ? `: ${state.f['x:sizeSkew']}` : ''}`} title={state.f['x:sizeSkew'] || 'Size weighting'}>{w.map((x, i) => <span key={i} className={`flex-1 rounded-sm ${i === selected ? 'bg-primary' : 'bg-muted-foreground/50'}`} style={{ height: `${Math.max(15, Math.min(100, x * list.length * 50))}%` }} />)}</span>; })()}
      {note && <span className="text-xs italic text-muted-foreground">{note}</span>}
      {list.length > 1 && (
        <div className="ml-auto flex gap-1">
          {list.map((x, i) => (
            <Button key={x.id} size="sm" variant={i === selected ? 'default' : 'outline'} className="h-7 w-8 px-0" onClick={() => onSelect(i)} aria-label={`Show tranche ${x.label}`}>{x.label || String.fromCharCode(65 + i)}</Button>
          ))}
        </div>
      )}
    </div>
  );
}
