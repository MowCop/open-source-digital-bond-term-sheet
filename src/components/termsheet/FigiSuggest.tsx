import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lookupFigis, type FigiRecord } from '@/lib/openfigi';

interface Props {
  rows: Array<{ Type?: string; Value?: string }>;
  canEdit: boolean;
  onAdd: (figi: string) => void;
}

/** OpenFIGI match under the Identifier list when an ISIN is held and no FIGI is. Never auto-applies. */
export default function FigiSuggest({ rows, canEdit, onAdd }: Props) {
  const isin = (rows.find(r => r.Type === 'ISIN')?.Value ?? '').trim().toUpperCase();
  const hasFigi = rows.some(r => r.Type === 'FIGI' && (r.Value ?? '').trim());
  const active = canEdit && !hasFigi && /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin);
  const [rec, setRec] = useState<FigiRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) { setRec(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try { const r = await lookupFigis([isin]); if (!cancelled) setRec(r[isin] ?? null); }
      catch { if (!cancelled) setRec(null); }
      finally { if (!cancelled) setBusy(false); }
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isin, active]);

  if (!active) return null;
  if (busy) return <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Looking up {isin} on OpenFIGI…</p>;
  if (!rec) return null;
  if (!rec.found) return <p className="text-[11px] text-muted-foreground">No FIGI on OpenFIGI for {isin} yet — normal before pricing.</p>;
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 p-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[11px] font-medium text-muted-foreground">OpenFIGI match</span>
      <span className="font-medium">{rec.name}</span>
      {rec.ticker && <span className="text-muted-foreground">{rec.ticker}</span>}
      <code className="text-[11px] text-muted-foreground">{rec.figi}</code>
      <Button size="sm" variant="outline" className="h-6 text-[11px] ml-auto" onClick={() => rec.figi && onAdd(rec.figi)}>Use</Button>
    </div>
  );
}
