import { Button } from '@/components/ui/button';
import type { DealWorkspace } from '@/lib/dealWorkspace';

export default function TrancheSwitcher({ ws, selected, onSelect, note }: { ws: DealWorkspace | null; selected: number; onSelect: (i: number) => void; note?: string }) {
  const list = ws?.tranches ?? [];
  const t = list[selected];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
      <span className="font-medium">Tranche {t?.label || 'A'}</span>
      {t && <span className="text-muted-foreground">· {[t.currency && t.amount != null ? `${t.currency} ${t.amount >= 1e9 ? `${t.amount / 1e9}bn` : `${t.amount / 1e6}m`}` : t.currency, t.tenor, t.rateType === 'floating' ? 'Floating' : 'Fixed'].filter(Boolean).join(' · ')}</span>}
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
