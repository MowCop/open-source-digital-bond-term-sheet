import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import {
  PROTOCOLS, AUTH_METHODS, ENVIRONMENTS, CERTIFICATIONS, defaultFixSession,
  type ConnectivityProfile, type FixSession,
} from '@/lib/connectivity';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm';

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label htmlFor={id} className="text-xs">{label}</Label>{children}</div>;
}

export function ConnectivityEditor({ value, onChange }: { value: ConnectivityProfile[]; onChange: (v: ConnectivityProfile[]) => void }) {
  const update = (i: number, patch: Partial<ConnectivityProfile>) => onChange(value.map((p, j) => {
    if (j !== i) return p;
    const next = { ...p, ...patch };
    if (next.protocol === 'FIX' && !next.fix) next.fix = defaultFixSession();
    if (next.protocol !== 'FIX') delete next.fix;
    return next;
  }));
  const updateFix = (i: number, patch: Partial<FixSession>) => update(i, { fix: { ...(value[i].fix || defaultFixSession()), ...patch } });
  const add = () => onChange([...value, { id: `p-${crypto.randomUUID()}`, protocol: 'To be confirmed', label: '', direction: 'pull', environment: 'Production', auth: 'To be confirmed' }]);

  return (
    <section className="space-y-3" aria-label="Connectivity">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Connectivity</h3>
          <p className="text-xs text-muted-foreground">A record of how this vendor connects. Nothing here opens a live connection.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3.5 w-3.5" /> Add profile</Button>
      </div>
      {value.length === 0 && <p className="text-xs text-muted-foreground">No profiles — shown as "To be confirmed".</p>}
      {value.map((p, i) => {
        const k = `${p.id}-`;
        return (
          <div key={p.id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium flex-1 truncate">{p.label || 'New profile'}</span>
              {p.docsUrl && <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><BookOpen className="h-3.5 w-3.5" /> Docs</a>}
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={`Remove ${p.label || 'profile'}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field id={k + 'label'} label="Label"><Input id={k + 'label'} className="h-9" value={p.label} onChange={e => update(i, { label: e.target.value })} /></Field>
              <Field id={k + 'protocol'} label="Protocol"><select id={k + 'protocol'} className={selectCls} value={p.protocol} onChange={e => update(i, { protocol: e.target.value as ConnectivityProfile['protocol'] })}>{PROTOCOLS.map(o => <option key={o}>{o}</option>)}</select></Field>
              <Field id={k + 'version'} label="Version"><Input id={k + 'version'} className="h-9" value={p.version || ''} onChange={e => update(i, { version: e.target.value || undefined })} /></Field>
              <Field id={k + 'direction'} label="Direction"><select id={k + 'direction'} className={selectCls} value={p.direction} onChange={e => update(i, { direction: e.target.value as ConnectivityProfile['direction'] })}><option value="push">Push</option><option value="pull">Pull</option><option value="email">Email</option></select></Field>
              <Field id={k + 'env'} label="Environment"><select id={k + 'env'} className={selectCls} value={p.environment} onChange={e => update(i, { environment: e.target.value as ConnectivityProfile['environment'] })}>{ENVIRONMENTS.map(o => <option key={o}>{o}</option>)}</select></Field>
              <Field id={k + 'auth'} label="Auth method"><select id={k + 'auth'} className={selectCls} value={p.auth} onChange={e => update(i, { auth: e.target.value as ConnectivityProfile['auth'] })}>{AUTH_METHODS.map(o => <option key={o}>{o}</option>)}</select></Field>
              <Field id={k + 'endpoint'} label="Endpoint or host:port"><Input id={k + 'endpoint'} className="h-9" value={p.endpoint || ''} onChange={e => update(i, { endpoint: e.target.value || undefined })} /></Field>
              <Field id={k + 'secret'} label="Secret name (never the value)"><Input id={k + 'secret'} className="h-9" placeholder="VENDOR_API_KEY" autoComplete="off" value={p.secretRef || ''} onChange={e => update(i, { secretRef: e.target.value || undefined })} /></Field>
              <Field id={k + 'licence'} label="Licence reference"><Input id={k + 'licence'} className="h-9" value={p.licenceRef || ''} onChange={e => update(i, { licenceRef: e.target.value || undefined })} /></Field>
              <Field id={k + 'sdk'} label="SDK version"><Input id={k + 'sdk'} className="h-9" value={p.sdkVersion || ''} onChange={e => update(i, { sdkVersion: e.target.value || undefined })} /></Field>
              <div className="col-span-2"><Field id={k + 'docs'} label="Docs URL"><Input id={k + 'docs'} type="url" className="h-9" placeholder="https://" value={p.docsUrl || ''} onChange={e => update(i, { docsUrl: e.target.value || undefined })} /></Field></div>
            </div>
            {p.protocol === 'FIX' && p.fix && (
              <div className="grid grid-cols-2 gap-2 rounded border border-dashed p-2">
                <p className="col-span-2 text-xs font-medium">FIX session</p>
                <Field id={k + 'bs'} label="BeginString"><Input id={k + 'bs'} className="h-9" value={p.fix.beginString} onChange={e => updateFix(i, { beginString: e.target.value })} /></Field>
                <Field id={k + 'avi'} label="ApplVerID"><Input id={k + 'avi'} className="h-9" value={p.fix.applVerId} onChange={e => updateFix(i, { applVerId: e.target.value })} /></Field>
                <Field id={k + 'snd'} label="SenderCompID"><Input id={k + 'snd'} className="h-9" value={p.fix.senderCompId} onChange={e => updateFix(i, { senderCompId: e.target.value })} /></Field>
                <Field id={k + 'tgt'} label="TargetCompID"><Input id={k + 'tgt'} className="h-9" value={p.fix.targetCompId} onChange={e => updateFix(i, { targetCompId: e.target.value })} /></Field>
                <Field id={k + 'host'} label="Host"><Input id={k + 'host'} className="h-9" value={p.fix.host} onChange={e => updateFix(i, { host: e.target.value })} /></Field>
                <Field id={k + 'port'} label="Port"><Input id={k + 'port'} type="number" className="h-9" value={p.fix.port ?? ''} onChange={e => updateFix(i, { port: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
                <Field id={k + 'hb'} label="Heartbeat (seconds)"><Input id={k + 'hb'} type="number" className="h-9" value={p.fix.heartbeatSec} onChange={e => updateFix(i, { heartbeatSec: Number(e.target.value) })} /></Field>
                <Field id={k + 'cert'} label="Certification"><select id={k + 'cert'} className={selectCls} value={p.fix.certification} onChange={e => updateFix(i, { certification: e.target.value as FixSession['certification'] })}>{CERTIFICATIONS.map(o => <option key={o}>{o}</option>)}</select></Field>
              </div>
            )}
            <Field id={k + 'notes'} label="Notes"><Textarea id={k + 'notes'} rows={2} value={p.notes || ''} onChange={e => update(i, { notes: e.target.value || undefined })} /></Field>
          </div>
        );
      })}
    </section>
  );
}
