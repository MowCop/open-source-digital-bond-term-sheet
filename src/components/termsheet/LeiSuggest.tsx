import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { rankCandidates, searchLeiByName, type LeiCandidate } from '@/lib/gleif';

interface Props {
  name: string;
  lei: string;
  canEdit: boolean;
  onUse: (lei: string) => void;
}

/** GLEIF suggestions under an empty LEI box. Never auto-applies — the user must click Use. */
export default function LeiSuggest({ name, lei, canEdit, onUse }: Props) {
  const [list, setList] = useState<LeiCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const active = canEdit && !lei.trim() && name.trim().length >= 2;

  useEffect(() => {
    if (!active) { setList([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      const res = await searchLeiByName(name);
      if (!cancelled) { setList(rankCandidates(name, res)); setBusy(false); }
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [name, active]);

  if (!active) return null;
  if (busy && list.length === 0)
    return <p id="lei-suggest" className="sm:col-span-2 lg:col-span-3 text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Searching GLEIF for “{name}”…</p>;
  if (list.length === 0) return null;

  return (
    <div className="sm:col-span-2 lg:col-span-3 rounded-md border border-border/50 bg-muted/30 p-2 space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">GLEIF suggestions for the LEI</p>
      {list.map(c => (
        <div key={c.lei} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">{c.legalName}</span>
          <span className="text-muted-foreground">{c.country}</span>
          <Badge variant={c.entityStatus === 'ACTIVE' ? 'secondary' : 'outline'} className="text-[10px]">
            {c.entityStatus === 'ACTIVE' ? 'Active' : c.entityStatus || 'Unknown'}{c.registrationStatus && c.registrationStatus !== 'ISSUED' ? ` · ${c.registrationStatus.toLowerCase()}` : ''}
          </Badge>
          {c.best && <Badge className="text-[10px]">Best match</Badge>}
          <code className="text-[11px] text-muted-foreground">{c.lei}</code>
          <Button size="sm" variant="outline" className="h-6 text-[11px] ml-auto" onClick={() => onUse(c.lei)}>Use</Button>
        </div>
      ))}
    </div>
  );
}
