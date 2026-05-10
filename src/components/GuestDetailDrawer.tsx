import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScopedApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, RefreshCw, Trash2, X, Plus, KeyRound } from 'lucide-react';

export interface GuestRow {
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

interface Props {
  guest: GuestRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}

export default function GuestDetailDrawer({ guest, open, onOpenChange, onChanged }: Props) {
  const { deals } = useScopedApp();
  const { authUser } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [addDealId, setAddDealId] = useState<string>('');

  const status = useMemo(() => {
    if (!guest) return 'active';
    if (guest.revoked_at) return 'revoked';
    if (guest.expires_at && new Date(guest.expires_at) < new Date()) return 'expired';
    return 'active';
  }, [guest]);

  const readOnly = status !== 'active';

  const authorisedDeals = useMemo(
    () => (guest?.deal_ids ?? []).map(id => deals.find(d => d.id === id) || { id, issuerName: id, currency: '', size: '', tenor: '', stage: 'unknown' as any }),
    [guest, deals]
  );

  const availableToAdd = useMemo(
    () => deals.filter(d => !(guest?.deal_ids ?? []).includes(d.id)),
    [deals, guest]
  );

  if (!guest) return null;

  const audit = async (action: string, details: string) => {
    try {
      await supabase.from('audit_log').insert({
        id: `gd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action,
        entity_type: 'guest_passcode',
        entity_id: guest.id,
        user_id: authUser?.id ?? 'unknown',
        details,
      });
    } catch (e) {
      console.warn('[GuestDetailDrawer] audit failed', e);
    }
  };

  const updateDeals = async (next: string[], diffLabel: string) => {
    setBusy(true);
    const { error } = await supabase
      .from('guest_passcodes')
      .update({ deal_ids: next })
      .eq('id', guest.id);
    setBusy(false);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    await audit('guest_deal_access_changed', diffLabel);
    onChanged();
  };

  const removeDeal = (dealId: string) => {
    if (!confirm('Remove this deal from the guest\'s access?')) return;
    const next = (guest.deal_ids ?? []).filter(id => id !== dealId);
    const d = deals.find(x => x.id === dealId);
    updateDeals(next, `Removed deal ${d ? d.issuerName : dealId} from guest ${guest.email}`);
  };

  const addDeal = () => {
    if (!addDealId) return;
    const next = [...(guest.deal_ids ?? []), addDealId];
    const d = deals.find(x => x.id === addDealId);
    updateDeals(next, `Granted deal ${d ? d.issuerName : addDealId} to guest ${guest.email}`);
    setAddDealId('');
  };

  const regenerate = async () => {
    if (!confirm('Generate a new passcode? The old one will stop working immediately.')) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('invite-guest', {
      body: { regeneratePasscodeId: guest.id },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast({ title: 'Failed', description: error?.message || data?.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'New passcode generated', description: data.passcode });
    onChanged();
  };

  const revoke = async () => {
    if (!confirm('Revoke this guest\'s access? They will be locked out immediately.')) return;
    setBusy(true);
    const { error } = await supabase
      .from('guest_passcodes')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', guest.id);
    setBusy(false);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    await audit('guest_revoked', `Revoked guest ${guest.email}`);
    toast({ title: 'Guest revoked', description: guest.email });
    onChanged();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: text });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {guest.name || guest.email}
            <Badge variant={status === 'active' ? 'default' : 'secondary'} className="capitalize">{status}</Badge>
          </SheetTitle>
          <SheetDescription>{guest.email}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Invited</div>
              <div>{new Date(guest.created_at).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expires</div>
              <div>{guest.expires_at ? new Date(guest.expires_at).toLocaleDateString() : 'Never'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last used</div>
              <div>{guest.last_used_at ? new Date(guest.last_used_at).toLocaleString() : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Deals</div>
              <div>{(guest.deal_ids ?? []).length}</div>
            </div>
          </div>

          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Passcode</div>
                <Button variant="ghost" size="sm" onClick={regenerate} disabled={busy || readOnly}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted px-2 py-1 rounded flex-1">{guest.passcode}</code>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(guest.passcode)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="text-sm font-semibold mb-2">Authorised deals</div>
            {authorisedDeals.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No deals assigned.</p>
            )}
            <div className="space-y-2">
              {authorisedDeals.map(d => (
                <div key={d.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{d.issuerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.currency} {d.size} · {d.tenor} · {d.stage}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={readOnly || busy} onClick={() => removeDeal(d.id)}>
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {!readOnly && availableToAdd.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Select value={addDealId} onValueChange={setAddDealId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Grant access to another deal…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAdd.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.issuerName} · {d.currency} {d.size} · {d.tenor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addDeal} disabled={!addDealId || busy} size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="gap-2">
          {!readOnly && (
            <Button variant="destructive" onClick={revoke} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-1" /> Revoke access
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}