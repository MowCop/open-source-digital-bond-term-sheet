import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { type DealWorkspace, type Tranche, duplicateTranche, newTrancheId } from '@/lib/dealWorkspace';

const letter = (i: number) => String.fromCharCode(65 + i);
export const parseStructureAmount = (s: string): number | null => {
  const t = s.replace(/[, ]/g, '').toLowerCase();
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)(bn|b|m|mm|k)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'bn' || m[2] === 'b' ? n * 1e9 : m[2] === 'm' || m[2] === 'mm' ? n * 1e6 : m[2] === 'k' ? n * 1e3 : n;
};

/** Shared tranche table used by the Deal structure dialog and Create New Deal. */
export default function TrancheStructureEditor({ value: d, onChange }: { value: DealWorkspace; onChange: (w: DealWorkspace) => void }) {
  const set = (tranches: Tranche[]) => onChange({ ...d, tranches: tranches.map((t, i) => ({ ...t, label: letter(i) })) });
  const upd = (i: number, p: Partial<Tranche>) => set(d.tranches.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const move = (i: number, dir: -1 | 1) => { const a = [...d.tranches]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a); };
  const remove = (i: number) => {
    if (Object.keys(d.tranches[i].values).length && !confirm(`Tranche ${d.tranches[i].label} has recorded terms. Remove it?`)) return;
    set(d.tranches.filter((_, j) => j !== i));
  };
  const add = () => set([...d.tranches, { id: newTrancheId(), label: '', rateType: d.tranches.at(-1)?.rateType ?? 'fixed', currency: d.tranches.at(-1)?.currency ?? '', amount: null, values: {} }]);
  const applyAll = (rt: 'fixed' | 'floating') => set(d.tranches.map(t => ({ ...t, rateType: rt })));
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-3">
        <span>Tranches: {d.tranches.length}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => applyAll('fixed')}>All fixed</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => applyAll('floating')}>All floating</Button>
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
                  <SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="floating">Floating</SelectItem><SelectItem value="zero">Zero coupon</SelectItem></SelectContent>
                </Select>
              </td>
              <td className="pr-2"><Input className="h-8 w-20" value={t.currency} maxLength={3} onChange={e => upd(i, { currency: e.target.value.toUpperCase() })} /></td>
              <td className="pr-2"><Input className="h-8 w-36" placeholder="e.g. 500m" defaultValue={t.amount ?? ''} onBlur={e => upd(i, { amount: parseStructureAmount(e.target.value) })} /></td>
              <td className="pr-2"><Input className="h-8 w-20" value={t.tenor ?? ''} onChange={e => upd(i, { tenor: e.target.value })} /></td>
              <td className="whitespace-nowrap">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Duplicate" disabled={d.tranches.length >= 10} onClick={() => set([...d.tranches.slice(0, i + 1), duplicateTranche(t, ''), ...d.tranches.slice(i + 1)])}><Copy className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove" disabled={d.tranches.length <= 1} onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <Button type="button" size="sm" variant="outline" disabled={d.tranches.length >= 10} onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Add tranche</Button>
    </div>
  );
}
