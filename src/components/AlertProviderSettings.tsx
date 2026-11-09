import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { loadAlertStatus, loadOrgAlertSettings, saveOrgAlertSettings, type AlertStatus, type OrgAlertSettings } from '@/lib/distribution';
import { PROVIDERS, STATUS_LABEL, providerStatus, ALERT_FROM_DOMAIN } from '@/lib/alertMail';

/** Per-organisation alert email provider and the always-BCC syndicate mailbox. */
export default function AlertProviderSettings() {
  const [s, setS] = useState<OrgAlertSettings>({ provider: 'resend', syndicate_mailbox: '' });
  const [status, setStatus] = useState<AlertStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadOrgAlertSettings().then(setS).catch(() => {}); loadAlertStatus().then(setStatus); }, []);
  const st = providerStatus(s.provider, { resendVerified: status?.resendVerified, graphConnected: status?.graphConnected });

  const save = async () => {
    setBusy(true);
    try { await saveOrgAlertSettings(s); toast.success('Alert settings saved'); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="rounded-md border p-3 space-y-3" aria-label="Alert email settings">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="alert-provider">Email provider</Label>
          <select id="alert-provider" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={s.provider} onChange={e => setS({ ...s, provider: e.target.value as OrgAlertSettings['provider'] })}>
            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={st === 'ready' ? 'default' : 'outline'} className="text-[10px]">{STATUS_LABEL[st]}</Badge>
          </div>
          {s.provider === 'resend' && st === 'domain_not_verified' && <p className="text-xs text-muted-foreground">Add and verify {ALERT_FROM_DOMAIN} in Resend before sending.</p>}
          {s.provider === 'microsoft_graph' && <>
            <p className="text-xs text-muted-foreground">Sends as the deal admin from their own bank mailbox. Needs your Microsoft 365 tenant admin to consent to Mail.Send.</p>
            <Button type="button" size="sm" variant="outline" disabled>Connect Microsoft 365 (coming soon)</Button>
          </>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="alert-mailbox">Syndicate mailbox (always BCC)</Label>
          <Input id="alert-mailbox" type="email" placeholder="syndicate@yourbank.com" value={s.syndicate_mailbox} onChange={e => setS({ ...s, syndicate_mailbox: e.target.value })} />
          <p className="text-xs text-muted-foreground">Required. Use a desk mailbox, not an individual.</p>
        </div>
      </div>
      <Button type="button" size="sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save alert settings'}</Button>
    </div>
  );
}
