import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const REQUESTS = [
  { k: 'sdk', l: 'Headless Taxonomy Engine / Shared Library (SDK, microservice, Docker)' },
  { k: 'api_mcp', l: 'Programmatic API & MCP server credentials (Claude / internal agents)' },
  { k: 'vpc', l: 'Self-hosted private VPC deployment package' },
];
const SYSTEMS = ['Bloomberg', 'Symphony', 'Murex', 'Ipreo / Dealogic', 'Refinitiv', 'Calypso', 'Other'];

export function makeIntakeReference(d = new Date()) {
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BDT-${d.toISOString().slice(0, 10).replace(/-/g, '')}-${r}`;
}

export default function BankIntakeDialog({ open, onOpenChange, dealId }: { open: boolean; onOpenChange: (o: boolean) => void; dealId?: string }) {
  const [form, setForm] = useState({ institution: '', name: '', email: '', phone: '', desk: '', reqs: '' });
  const [types, setTypes] = useState<string[]>([]);
  const [systems, setSystems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const toggle = (arr: string[], f: (a: string[]) => void, k: string) => f(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const ok = form.institution.trim() && form.name.trim() && /\S+@\S+\.\S+/.test(form.email) && types.length > 0;

  async function submit() {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); toast.error('Please sign in first.'); return; }
    const reference = makeIntakeReference();
    const { error } = await supabase.from('bank_intake_requests').insert({
      reference, user_id: u.user.id, institution: form.institution.trim(), contact_name: form.name.trim(),
      contact_email: form.email.trim(), contact_phone: form.phone.trim() || null, desk_role: form.desk.trim() || null,
      request_types: types, internal_systems: systems, requirements: form.reqs.trim() || null, deal_id: dealId ?? null,
    });
    setBusy(false);
    if (error) { toast.error(`Could not submit: ${error.message}`); return; }
    setRef(reference);
  }

  const close = (o: boolean) => { if (!o) { setRef(null); } onOpenChange(o); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Bank Enterprise SDK / API Access</DialogTitle>
          <DialogDescription>For banks and syndicate desks integrating the ICMA BDT 2.0 taxonomy engine.</DialogDescription>
        </DialogHeader>
        {ref ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">Request received. Your reference:</p>
            <p className="font-mono text-xl font-semibold">{ref}</p>
            <p className="text-sm text-muted-foreground">Quote this reference in any follow-up.</p>
            <Button onClick={() => close(false)}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Access requested</Label>
              {REQUESTS.map((r) => (
                <label key={r.k} className="flex items-start gap-2 text-sm">
                  <Checkbox checked={types.includes(r.k)} onCheckedChange={() => toggle(types, setTypes, r.k)} /> {r.l}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Institution *</Label><Input value={form.institution} onChange={set('institution')} /></div>
              <div><Label>Desk / role</Label><Input value={form.desk} onChange={set('desk')} placeholder="e.g. DCM Syndicate" /></div>
              <div><Label>Contact name *</Label><Input value={form.name} onChange={set('name')} /></div>
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={set('email')} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={set('phone')} /></div>
            </div>
            <div className="space-y-2">
              <Label>Primary internal systems</Label>
              <div className="flex flex-wrap gap-3">
                {SYSTEMS.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-sm"><Checkbox checked={systems.includes(s)} onCheckedChange={() => toggle(systems, setSystems, s)} />{s}</label>
                ))}
              </div>
            </div>
            <div><Label>Integration requirements</Label><Textarea rows={4} value={form.reqs} onChange={set('reqs')} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button disabled={!ok || busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit request'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
