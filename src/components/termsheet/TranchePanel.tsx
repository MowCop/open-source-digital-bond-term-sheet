import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Maximize2 } from 'lucide-react';
import TermSheetField from './TermSheetField';
import type { Tranche } from '@/lib/dealWorkspace';
import { trancheFields, trancheValue, SENIORITY_LABEL, SENIORITY_PRESET, type Seniority, type Scope } from '@/lib/trancheFields';

const SCOPE_TITLE: Record<Scope, string> = {
  deal: 'Same for all tranches',
  copied: 'Copied from Tranche A (editable)',
  own: 'This tranche only',
};

export interface TrancheSave { main: Record<string, string>; own: Record<string, unknown>; seniority: Seniority }

export default function TranchePanel({ tranche, isFirst, issuer, main, canEdit, onSave, onPopOut }: {
  tranche: Tranche; isFirst: boolean; issuer: string; main: Record<string, string>; canEdit: boolean;
  onSave: (s: TrancheSave) => Promise<void> | void; onPopOut?: () => void;
}) {
  const [seniority, setSeniority] = useState<Seniority>(tranche.seniority ?? 'senior_unsecured');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fields = useMemo(() => trancheFields(tranche.rateType, seniority), [tranche.rateType, seniority]);
  const value = (p: string) => (p in edits ? edits[p] : trancheValue(p, isFirst, main, tranche.values));
  const dirty = Object.keys(edits).length > 0 || seniority !== (tranche.seniority ?? 'senior_unsecured');

  const changeSeniority = (s: Seniority) => { setSeniority(s); setEdits(e => ({ ...e, ...SENIORITY_PRESET[s] })); };

  const save = async () => {
    const nextMain = { ...main }; const nextOwn = { ...tranche.values };
    for (const r of fields) {
      const v = value(r.p);
      if (isFirst || r.scope === 'deal') { if (r.p in edits) nextMain[r.p] = v; }
      else if (r.p in edits || r.scope === 'copied') nextOwn[r.p] = v;
    }
    setSaving(true);
    try { await onSave({ main: nextMain, own: nextOwn, seniority }); setEdits({}); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Tranche {tranche.label}</span>
        <Badge variant="outline">{tranche.rateType === 'fixed' ? 'Fixed rate' : 'Floating rate'}</Badge>
        <Select value={seniority} disabled={!canEdit} onValueChange={v => changeSeniority(v as Seniority)}>
          <SelectTrigger className="h-8 w-52" aria-label="Seniority"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(SENIORITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Issuer: <span className="text-foreground">{issuer || '—'}</span></span>
        <div className="ml-auto flex gap-2">
          {onPopOut && <Button size="sm" variant="ghost" onClick={onPopOut}><Maximize2 className="h-3.5 w-3.5 mr-1" />Pop out</Button>}
          {canEdit && <Button size="sm" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save tranche'}</Button>}
        </div>
      </div>
      {(['deal', 'copied', 'own'] as Scope[]).map(scope => {
        const rows = fields.filter(r => r.scope === scope);
        if (!rows.length) return null;
        return (
          <section key={scope} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isFirst && scope === 'copied' ? 'Shared starting values for other tranches' : SCOPE_TITLE[scope]}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(r => (
                <TermSheetField key={r.p} fd={r.fd} value={value(r.p)} disabled={!canEdit}
                  onChange={v => setEdits(e => ({ ...e, [r.p]: v }))} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
