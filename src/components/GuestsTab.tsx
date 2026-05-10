import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScopedApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Copy, KeyRound, RefreshCw, Trash2, Plus } from 'lucide-react';
import GuestDetailDrawer, { type GuestRow as DrawerGuestRow } from './GuestDetailDrawer';

interface GuestRow {
  id: string;
  email: string;
  name: string | null;
  passcode: string;
  deal_ids: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  created_by?: string | null;
}

export default function GuestsTab() {
  const { deals } = useScopedApp();
  const { toast } = useToast();
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState<string>('30');
  const [busy, setBusy] = useState(false);

  const [issued, setIssued] = useState<{ email: string; passcode: string } | null>(null);
  const [selected, setSelected] = useState<DrawerGuestRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guest_passcodes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Could not load guests', description: error.message, variant: 'destructive' });
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!email || selectedDeals.length === 0) {
      toast({ title: 'Missing fields', description: 'Email and at least one deal are required.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('invite-guest', {
      body: { email, name, dealIds: selectedDeals, expiresInDays: expiresInDays ? Number(expiresInDays) : null },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast({ title: 'Invite failed', description: error?.message || data?.error || 'Unknown error', variant: 'destructive' });
      return;
    }
    setIssued({ email, passcode: data.passcode });
    setShowInvite(false);
    setEmail(''); setName(''); setSelectedDeals([]); setExpiresInDays('30');
    load();
  };

  const regenerate = async (id: string) => {
    if (!confirm('Generate a new passcode? The old one will stop working immediately.')) return;
    const { data, error } = await supabase.functions.invoke('invite-guest', {
      body: { regeneratePasscodeId: id },
    });
    if (error || !data?.ok) {
      toast({ title: 'Failed', description: error?.message || data?.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'New passcode generated', description: data.passcode });
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this passcode? The guest will lose access immediately.')) return;
    const { error } = await supabase.from('guest_passcodes').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: text });
  };

  const dealLabel = (id: string) => {
    const d = deals.find(x => x.id === id);
    return d ? `${d.issuerName} ${d.currency} ${d.size}` : id;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Guest Access (Passcodes)</h3>
          <p className="text-xs text-muted-foreground">Invite read-only guests scoped to specific deals. They log in with email + passcode — no account required.</p>
        </div>
        <Button onClick={() => setShowInvite(true)}><Plus className="h-4 w-4 mr-2" />Invite Guest</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Passcode</TableHead>
            <TableHead>Deals</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No guest invites yet.</TableCell></TableRow>}
          {rows.map(r => {
            const expired = r.expires_at && new Date(r.expires_at) < new Date();
            const status = r.revoked_at ? 'revoked' : expired ? 'expired' : 'active';
            return (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => setSelected(r as DrawerGuestRow)}
              >
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.name || '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{r.passcode}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(r.passcode)}><Copy className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{(r.deal_ids || []).length} deal(s)</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : 'Never'}</TableCell>
                <TableCell>
                  <Badge variant={status === 'active' ? 'default' : 'secondary'}>{status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" title="Regenerate" onClick={() => regenerate(r.id)} disabled={!!r.revoked_at}><RefreshCw className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Revoke" onClick={() => revoke(r.id)} disabled={!!r.revoked_at}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <GuestDetailDrawer
        guest={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onChanged={() => { load(); setSelected(null); }}
      />

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Guest</DialogTitle>
            <DialogDescription>Generate a passcode that gives read-only access to the selected deals.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label>Name (optional)</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Expires in (days, blank = never)</Label>
              <Input type="number" min={1} value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} />
            </div>
            <div>
              <Label>Deals ({selectedDeals.length} selected)</Label>
              <div className="mt-2 max-h-56 overflow-auto border rounded-md p-2 space-y-1">
                {deals.length === 0 && <p className="text-xs text-muted-foreground p-2">No deals available.</p>}
                {deals.map(d => (
                  <label key={d.id} className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedDeals.includes(d.id)}
                      onCheckedChange={() => setSelectedDeals(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}
                    />
                    <span>{d.issuerName} · {d.currency} {d.size} · {d.tenor}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={invite} disabled={busy}>{busy ? 'Generating…' : 'Generate passcode'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><KeyRound className="h-5 w-5 inline mr-2" />Passcode issued</DialogTitle>
            <DialogDescription>Share this with the guest. Copy it now — they'll log in with their email and this code.</DialogDescription>
          </DialogHeader>
          {issued && (
            <Card><CardContent className="p-4 space-y-2">
              <div className="text-sm"><b>Email:</b> {issued.email}</div>
              <div className="flex items-center gap-2">
                <code className="text-lg bg-muted px-3 py-2 rounded flex-1">{issued.passcode}</code>
                <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(issued.passcode)}><Copy className="h-4 w-4" /></Button>
              </div>
            </CardContent></Card>
          )}
          <DialogFooter>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}