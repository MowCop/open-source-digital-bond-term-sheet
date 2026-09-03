import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookrunner } from '@/types/bond';
import { Sparkles, ArrowLeftRight, Check } from 'lucide-react';

export type DiffStatus = 'match' | 'changed' | 'ai_only' | 'user_only';

export interface DiffRow {
  field: string;
  aiValue: string;
  confirmedValue: string;
  status: DiffStatus;
}

export function buildDiffRows(
  aiParsed: Record<string, string> | null,
  confirmed: Record<string, string> | null,
): DiffRow[] {
  const keys = Array.from(new Set([...Object.keys(aiParsed || {}), ...Object.keys(confirmed || {})]));
  const rows: DiffRow[] = [];
  for (const field of keys) {
    const aiValue = (aiParsed?.[field] ?? '').trim();
    const confirmedValue = (confirmed?.[field] ?? '').trim();
    if (!aiValue && !confirmedValue) continue;
    let status: DiffStatus;
    if (aiValue && confirmedValue) status = aiValue === confirmedValue ? 'match' : 'changed';
    else if (aiValue) status = 'ai_only';
    else status = 'user_only';
    rows.push({ field, aiValue, confirmedValue, status });
  }
  // Differences first, then alphabetical
  const weight: Record<DiffStatus, number> = { changed: 0, ai_only: 1, user_only: 2, match: 3 };
  return rows.sort((a, b) => weight[a.status] - weight[b.status] || a.field.localeCompare(b.field));
}

const STATUS_LABEL: Record<DiffStatus, string> = {
  match: 'Match',
  changed: 'Edited',
  ai_only: 'AI only',
  user_only: 'Yours only',
};

const STATUS_CLASS: Record<DiffStatus, string> = {
  match: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  changed: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  ai_only: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  user_only: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiParsed: Record<string, string> | null;
  confirmed: Record<string, string> | null;
  aiBookrunners?: Bookrunner[];
  confirmedBookrunners?: Bookrunner[];
  /** Apply a single AI value to the confirmed set. */
  onUseAiValue?: (field: string, value: string) => void;
  /** Apply every differing AI value at once. */
  onUseAllAiValues?: (values: Record<string, string>) => void;
  /** Optional confirm action, e.g. "Confirm & Send". */
  confirmLabel?: string;
  onConfirm?: () => void;
}

export default function FieldDiffDialog({
  open,
  onOpenChange,
  aiParsed,
  confirmed,
  aiBookrunners = [],
  confirmedBookrunners = [],
  onUseAiValue,
  onUseAllAiValues,
  confirmLabel,
  onConfirm,
}: Props) {
  const rows = useMemo(() => buildDiffRows(aiParsed, confirmed), [aiParsed, confirmed]);
  const diffCount = rows.filter(r => r.status !== 'match').length;

  const bookrunnerDiff = useMemo(() => {
    const a = aiBookrunners.map(b => b.name).sort();
    const c = confirmedBookrunners.map(b => b.name).sort();
    return { aiOnly: a.filter(n => !c.includes(n)), userOnly: c.filter(n => !a.includes(n)) };
  }, [aiBookrunners, confirmedBookrunners]);

  const applyAll = () => {
    const values: Record<string, string> = {};
    rows.forEach(r => {
      if ((r.status === 'changed' || r.status === 'ai_only') && r.aiValue) values[r.field] = r.aiValue;
    });
    onUseAllAiValues?.(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-info" />
            Compare AI-parsed vs confirmed values
          </DialogTitle>
          <DialogDescription>
            {diffCount > 0
              ? `${diffCount} field${diffCount === 1 ? '' : 's'} differ from what the AI parsed. Review before the alert goes out.`
              : 'Every confirmed value matches the AI-parsed data.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
          {(['changed', 'ai_only', 'user_only', 'match'] as DiffStatus[]).map(s => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full border ${STATUS_CLASS[s]}`} />
              {STATUS_LABEL[s]}
            </span>
          ))}
          {diffCount > 0 && onUseAllAiValues && (
            <Button size="sm" variant="outline" className="ml-auto h-7 text-[11px]" onClick={applyAll}>
              <Sparkles className="h-3 w-3 mr-1" /> Use all AI values
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold w-[22%]">Field</th>
                <th className="px-3 py-2 font-semibold text-info w-[30%]">AI parsed</th>
                <th className="px-3 py-2 font-semibold text-info w-[30%]">Your confirmed value</th>
                <th className="px-3 py-2 font-semibold w-[18%]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    Nothing to compare yet — run AI extraction first.
                  </td>
                </tr>
              )}
              {rows.map(r => (
                <tr key={r.field} className={r.status === 'changed' ? 'bg-amber-500/5' : undefined}>
                  <td className="px-3 py-2 text-muted-foreground align-top">{r.field}</td>
                  <td className={`px-3 py-2 align-top ${r.status === 'match' ? 'text-foreground' : 'text-amber-200 font-semibold'}`}>
                    {r.aiValue || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 align-top text-foreground font-medium">
                    {r.confirmedValue || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                      {r.status !== 'match' && r.aiValue && onUseAiValue && (
                        <button
                          type="button"
                          className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                          onClick={() => onUseAiValue(r.field, r.aiValue)}
                        >
                          Use AI
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(bookrunnerDiff.aiOnly.length > 0 || bookrunnerDiff.userOnly.length > 0) && (
          <div className="shrink-0 rounded-md border border-border p-3 text-[11px] space-y-1">
            <div className="font-semibold">Bookrunners</div>
            {bookrunnerDiff.aiOnly.length > 0 && (
              <div className="text-amber-300">AI only: {bookrunnerDiff.aiOnly.join(', ')}</div>
            )}
            {bookrunnerDiff.userOnly.length > 0 && (
              <div className="text-muted-foreground">Yours only: {bookrunnerDiff.userOnly.join(', ')}</div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0 pt-1">
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onConfirm && (
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={onConfirm}>
              <Check className="h-4 w-4 mr-1" /> {confirmLabel || 'Confirm'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
