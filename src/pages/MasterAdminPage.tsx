import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/RoleBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Info } from 'lucide-react';
import BankIntakeAdmin from '@/components/BankIntakeAdmin';

type Row = {
  user_id: string;
  email: string;
  name: string | null;
  organization: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  syndicate_admin: boolean;
};

export default function MasterAdminPage() {
  const { authUser, isMaster } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: roleRows, error: roleErr }] = await Promise.all([
      supabase
      .from('profiles')
      .select('user_id, email, name, organization, status, created_at')
        .order('name', { ascending: true, nullsFirst: false }),
      supabase.from('user_roles').select('user_id, role').eq('role', 'syndicate_admin'),
    ]);
    if (error || roleErr) {
      toast({ title: 'Failed to load users', description: (error || roleErr)?.message, variant: 'destructive' });
    } else {
      const synSet = new Set((roleRows ?? []).map((r: { user_id: string }) => r.user_id));
      const merged = (data ?? []).map((r: Omit<Row, 'syndicate_admin'>) => ({
        ...r,
        syndicate_admin: synSet.has(r.user_id),
      }));
      setRows(merged as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => { if (isMaster) load(); }, [isMaster]);

  if (!isMaster) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card><CardContent className="p-6 text-center">
          <Shield className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Restricted — Master Admin only.</p>
        </CardContent></Card>
      </div>
    );
  }

  const toggle = async (row: Row, active: boolean) => {
    const newStatus = active ? 'approved' : 'rejected';
    setBusy(row.user_id);
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('user_id', row.user_id);
    setBusy(null);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.map(r => r.user_id === row.user_id ? { ...r, status: newStatus } : r));
    // Master Admin–only audit entry (RLS hides this from everyone but Master Admin)
    try {
      await supabase.from('audit_log').insert({
        id: `ma_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: active ? 'MASTER_USER_ACTIVATED' : 'MASTER_USER_DEACTIVATED',
        entity_type: 'master_admin',
        entity_id: row.user_id,
        user_id: authUser?.id ?? 'master-admin',
        details: `${active ? 'Activated' : 'Deactivated'} ${row.email}`,
      });
    } catch (e) {
      console.warn('[MasterAdmin] audit insert failed', e);
    }
    toast({ title: active ? 'User activated' : 'User deactivated', description: row.email });
  };

  const toggleSyndicate = async (row: Row, grant: boolean) => {
    setBusy(row.user_id);
    let error;
    if (grant) {
      ({ error } = await supabase
        .from('user_roles')
        .upsert({ user_id: row.user_id, role: 'syndicate_admin' }, { onConflict: 'user_id,role' }));
    } else {
      ({ error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', row.user_id)
        .eq('role', 'syndicate_admin'));
    }
    setBusy(null);
    if (error) {
      toast({ title: 'Role update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.map(r => r.user_id === row.user_id ? { ...r, syndicate_admin: grant } : r));
    try {
      await supabase.from('audit_log').insert({
        id: `ma_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        action: grant ? 'MASTER_ROLE_GRANTED' : 'MASTER_ROLE_REVOKED',
        entity_type: 'master_admin',
        entity_id: row.user_id,
        user_id: authUser?.id ?? 'master-admin',
        details: `${grant ? 'Granted' : 'Revoked'} syndicate_admin for ${row.email}`,
      });
    } catch (e) {
      console.warn('[MasterAdmin] role audit insert failed', e);
    }
    toast({ title: grant ? 'Syndicate Admin granted' : 'Syndicate Admin revoked', description: row.email });
  };

  const filtered = rows.filter(r => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (r.email?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.organization?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Master Admin
          </h1>
          <p className="text-muted-foreground text-sm">Activate or deactivate registered users.</p>
        </div>
        <Input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search name, email, organization"
          className="max-w-xs"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">
                    <div className="inline-flex items-center justify-center gap-1">
                      <RoleBadge role="syndicate_admin" className="text-[10px] px-2 py-0.5" />
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="role-admin-icon inline-flex items-center justify-center rounded-full h-5 w-5 focus:outline-none">
                              <Info className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm text-xs leading-relaxed">
                            <p className="font-semibold mb-1">Syndicate Admin</p>
                            <p>Owner of their own deals, users and distribution lists.</p>
                            <p className="mt-2">Inside User Management → Guests they can invite anyone (even Syndicate Admins from other firms) as <b>read-only guests</b> on specific deals they own.</p>
                            <p className="mt-2">Read-only invites are per-deal and don't change the invitee's Syndicate Admin status.</p>
                            <p className="mt-2 italic">Example: Sarah (GlobalBank) invites Anna (EuroBank) as read-only on Deal A. Anna stays full Syndicate Admin on her own Deal B.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found.</TableCell></TableRow>
                )}
                {filtered.map(r => {
                  const active = r.status === 'approved';
                  const isSelf = r.user_id === authUser?.id;
                  return (
                    <TableRow key={r.user_id}>
                      <TableCell className="font-medium">{r.name || '—'}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.organization || '—'}</TableCell>
                      <TableCell>
                        {active
                          ? <Badge className="bg-success text-success-foreground">Active</Badge>
                          : <Badge variant="outline">{r.status === 'pending' ? 'Pending' : 'Inactive'}</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={r.syndicate_admin}
                          disabled={isSelf || busy === r.user_id}
                          onCheckedChange={(v) => toggleSyndicate(r, v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {busy === r.user_id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          <Switch
                            checked={active}
                            disabled={isSelf || busy === r.user_id}
                            onCheckedChange={(v) => toggle(r, v)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Deactivated users lose access on next page load.</p>
      <BankIntakeAdmin />
    </div>
  );
}
