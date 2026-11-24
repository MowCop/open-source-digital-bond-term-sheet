import { useAuth } from '@/context/AuthContext';
import { FieldStatusProvider, FieldStatusSummary, FieldStatusMark } from './FieldStatusContext';
import { confirmExpected, fieldRecord, transitionField, withExpected, metadataKey, type FieldMetadata } from '@/lib/fieldStatus';
import type { BdtState } from '@/lib/bdt-bridge';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const CURRENCY_PATH = 'IssuanceDataGroup/Issuance/SpecifiedCurrency';
const AMOUNT_PATH = 'IssuanceDataGroup/Product/AggregateNominalAmount/Value';

export interface TrancheSave { main: Record<string, string>; own: Record<string, unknown>; seniority: Seniority; fieldMeta: FieldMetadata; details: Pick<Tranche, 'currency' | 'amount' | 'tenor' | 'rateType'> }

export default function TranchePanel({ tranche, isFirst, issuer, main, fieldMeta = {}, canEdit, canEditField = () => true, onSave, onPopOut, hideIssuer }: {
  tranche: Tranche; isFirst: boolean; issuer: string; main: Record<string, string>; fieldMeta?: FieldMetadata; canEdit: boolean;
  onSave: (s: TrancheSave) => Promise<void> | void; onPopOut?: () => void; hideIssuer?: boolean;
  canEditField?: (path: string) => boolean;
}) {
  const {authUser}=useAuth();
  const [metadata,setMetadata]=useState<FieldMetadata>({});
  const [seniority, setSeniority] = useState<Seniority>(tranche.seniority ?? 'senior_unsecured');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState(() => ({ currency: tranche.currency, amount: tranche.amount, tenor: tranche.tenor ?? '', rateType: tranche.rateType }));
  const [detailsDirty, setDetailsDirty] = useState(false);
  const fields = useMemo(() => trancheFields(details.rateType, seniority), [details.rateType, seniority]);
  const value = (p: string) => (p in edits ? edits[p] : trancheValue(p, isFirst, main, tranche.values));
  const localMeta={...fieldMeta};
  for(const r of fields) {const own=fieldMeta[metadataKey(r.p,tranche.id)];if(!isFirst&&r.scope!=='deal'&&own)localMeta[r.p]=own;}
  const contextState=withExpected({f:Object.fromEntries(fields.map(r=>[r.p,value(r.p)])),fieldMeta:{...localMeta,...metadata},stage:1} as BdtState);
  const update=(p:string,v:string)=>{setEdits(e=>({...e,[p]:v}));const next=transitionField(contextState,p,v,authUser?.id??'');setMetadata(m=>({...m,[p]:next.fieldMeta?.[p] as NonNullable<typeof next.fieldMeta>[string]}));};
  const dirty = detailsDirty || Object.keys(edits).length > 0 || Object.keys(metadata).length > 0 || seniority !== (tranche.seniority ?? 'senior_unsecured');
  const changeDetails = (patch: Partial<typeof details>) => { setDetails(d => ({ ...d, ...patch })); setDetailsDirty(true); };

  const changeSeniority = (s: Seniority) => { setSeniority(s); setEdits(e => ({ ...e, ...SENIORITY_PRESET[s] })); };

  const save = async () => {
    const nextMain = { ...main }; const nextOwn = { ...tranche.values };
    for (const r of fields) {
      const v = value(r.p);
      if (isFirst || r.scope === 'deal') { if (r.p in edits) nextMain[r.p] = v; }
      else if (r.p in edits || r.scope === 'copied') nextOwn[r.p] = v;
    }
    setSaving(true);
    try { const output={...fieldMeta};for(const [p,r] of Object.entries({...contextState.fieldMeta,...metadata})) {const row=fields.find(f=>f.p===p);if(!row)continue;output[!isFirst&&row.scope!=='deal'?metadataKey(p,tranche.id):p]=r;}
      await onSave({ main: nextMain, own: nextOwn, seniority, details, fieldMeta:output }); setMetadata({}); setEdits({}); setDetailsDirty(false); } finally { setSaving(false); }
  };

  return (
    <FieldStatusProvider state={contextState} confirm={p=>{if(!canEdit||!canEditField(p))return;const next=confirmExpected(contextState,p,authUser?.id??'');update(p,next.f[p]);}}>
    <div className="space-y-4 p-3 text-sm">
      <FieldStatusSummary state={contextState} paths={fields.map(r=>r.p)}/>
      {issuer && !hideIssuer && <div className="text-2xl font-bold uppercase tracking-wide text-foreground">{issuer}</div>}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">Status</span>
        <Select value={seniority} disabled={!canEdit || !canEditField('status')} onValueChange={v => changeSeniority(v as Seniority)}>
          <SelectTrigger className="h-8 w-52" aria-label="Status of the Notes"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(SENIORITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        </div>
        <div className="ml-auto flex gap-2">
          {onPopOut && <Button size="sm" variant="ghost" onClick={onPopOut}><Maximize2 className="h-3.5 w-3.5 mr-1" />Pop out</Button>}
          {canEdit && <Button size="sm" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save tranche'}</Button>}
        </div>
      </div>
      {(['own', 'deal', 'copied'] as Scope[]).map(scope => {
        const rows = fields.filter(r => r.scope === scope && r.p !== CURRENCY_PATH && r.p !== AMOUNT_PATH);
        if (!rows.length) return null;
        return (
          <section key={scope} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isFirst && scope === 'copied' ? 'Shared starting values for other tranches' : SCOPE_TITLE[scope]}
            </h4>
            {scope === 'own' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-xs text-muted-foreground">Ccy <FieldStatusMark path={CURRENCY_PATH} disabled={!canEdit}/>
                <Input aria-label="Tranche currency" className="h-9 text-foreground" value={details.currency} maxLength={3} disabled={!canEdit} onChange={e => {
                  const currency = e.target.value.toUpperCase(); if(fieldRecord(contextState,CURRENCY_PATH).status==='set'&&!window.confirm('Change confirmed currency? The saved change will be audited.'))return; changeDetails({ currency }); update(CURRENCY_PATH,currency);
                }} />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">Amount <FieldStatusMark path={AMOUNT_PATH} disabled={!canEdit}/>
                <Input aria-label="Tranche amount" type="number" min="0" className="h-9 text-foreground" value={details.amount ?? ''} disabled={!canEdit} onChange={e => {
                  const raw = e.target.value; const amount = raw === '' ? null : Number(raw);
                  if(fieldRecord(contextState,AMOUNT_PATH).status==='set'&&!window.confirm('Change confirmed amount? The saved change will be audited.'))return; changeDetails({ amount }); update(AMOUNT_PATH,amount==null?'':String(amount));
                }} />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">Tenor <FieldStatusMark path="tenor" disabled={!canEdit}/>
                <Input aria-label="Tranche tenor" className="h-9 text-foreground" value={details.tenor} disabled={!canEdit} onChange={e => changeDetails({ tenor: e.target.value })} />
              </label>
              <div className="space-y-1 text-xs text-muted-foreground">
                <span>Rate type</span>
                <Select value={details.rateType} disabled={!canEdit} onValueChange={rateType => { if (rateType === 'fixed' || rateType === 'floating' || rateType === 'zero') changeDetails({ rateType }); }}>
                  <SelectTrigger aria-label="Tranche rate type" className="h-9 text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="fixed">Fixed rate</SelectItem><SelectItem value="floating">Floating rate</SelectItem><SelectItem value="zero">Zero coupon</SelectItem></SelectContent>
                </Select>
              </div>
            </div>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(r => (
                <TermSheetField key={r.p} fd={r.fd} value={value(r.p)} disabled={!canEdit || !canEditField(r.p)}
                  onChange={v => update(r.p,v)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
    </FieldStatusProvider>
  );
}
