import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Check, X, MoreHorizontal, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PendingProfile {
  user_id: string;
  email: string;
  name: string | null;
  organization: string | null;
  status: string;
  created_at: string;
}

const ALL_ROLES = [
  { value: 'syndicate_admin', label: 'Syndicate Admin' },
  { value: 'syndicate_readonly', label: 'Syndicate – Read Only' },
  { value: 'sales_readonly', label: 'Sales – Read Only' },
  { value: 'master_admin', label: 'Master Admin' },
];

export default function PendingApprovalsTab() {
  const { toast } = useToast();
  const { isMaster } = useAuth();
  const ROLES = isMaster ? ALL_ROLES : ALL_ROLES.filter(r => r.value !== 'master_admin');
  const [rows, setRows] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<PendingProfile | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<PendingProfile | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [loginStats, setLoginStats] = useState<Record<string, { lastSignInAt: string | null; confirmedAt: string | null }>>({});

  const formatRelative = (iso: string | null): string => {
    if (!iso) return 'Never';
    const diffMs = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    return `${mo}mo ago`;
  };

  const formatFullTimestamp = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never signed in';

  const lastLoginCell = (p: PendingProfile) => {
    if (p.status !== 'approved') {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    const stats = loginStats[p.email.toLowerCase()];
    const lastIso = stats?.lastSignInAt ?? null;
    if (!lastIso) {
      return <span className="text-xs text-muted-foreground" title="Never signed in">Never</span>;
    }
    const ageMs = Date.now() - new Date(lastIso).getTime();
    const tone =
      ageMs <= 86400000 ? 'text-success' :
      ageMs <= 7 * 86400000 ? 'text-warning' :
      'text-muted-foreground';
    return <span className={`text-xs ${tone}`} title={formatFullTimestamp(lastIso)}>{formatRelative(lastIso)}</span>;
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, name, organization, status, created_at')
      .neq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    const profiles = (data as any[]) ?? [];
    setRows(profiles as any);
    const ids = profiles.map(p => p.user_id);
    if (ids.length) {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', ids);
      const map: Record<string, string> = {};
      (roleRows ?? []).forEach((r: any) => { map[r.user_id] = r.role; });
      setRoleByUser(map);
    } else {
      setRoleByUser({});
    }
    const { data: statsData } = await supabase.rpc('get_user_login_stats');
    if (Array.isArray(statsData)) {
      const sMap: Record<string, { lastSignInAt: string | null; confirmedAt: string | null }> = {};
      for (const row of statsData as any[]) {
        if (row?.email) {
          sMap[String(row.email).toLowerCase()] = {
            lastSignInAt: row.last_sign_in_at ?? null,
            confirmedAt: row.confirmed_at ?? null,
          };
        }
      }
      setLoginStats(sMap);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (p: PendingProfile) => {
    const role = roleByUser[p.user_id] || 'syndicate_readonly';
    const { error: e1 } = await supabase.from('profiles').update({ status: 'approved' }).eq('user_id', p.user_id);
    const { error: e2 } = await supabase.from('user_roles').upsert({ user_id: p.user_id, role: role as any });
    if (e1 || e2) return toast({ title: 'Failed', description: (e1 || e2)?.message, variant: 'destructive' });
    toast({ title: 'Approved', description: `${p.email} as ${role}` });
    // Best-effort: email the user that their access has been approved.
    try {
      const { error: mailErr } = await supabase.functions.invoke('notify-user-on-approval', {
        body: { userId: p.user_id, role },
      });
      if (mailErr) {
        toast({
          title: 'Approved (email not sent)',
          description: `Approval saved, but notification email failed: ${mailErr.message}`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Approved (email not sent)',
        description: `Approval saved, but notification email failed: ${err?.message ?? String(err)}`,
        variant: 'destructive',
      });
    }
    load();
  };

  const reject = async (p: PendingProfile) => {
    const { error } = await supabase.from('profiles').update({ status: 'rejected' }).eq('user_id', p.user_id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    await supabase.from('audit_log').insert({ id: crypto.randomUUID(), action: 'USER_REJECTED', entity_type: 'user', entity_id: p.user_id, user_id: 'admin', details: `Rejected ${p.email}` });
    toast({ title: 'Rejected', description: p.email });
    load();
  };

  const revoke = async (p: PendingProfile) => {
    const { error: e1 } = await supabase.from('profiles').update({ status: 'rejected' }).eq('user_id', p.user_id);
    const { error: e2 } = await supabase.from('user_roles').delete().eq('user_id', p.user_id);
    if (e1 || e2) return toast({ title: 'Failed', description: (e1 || e2)?.message, variant: 'destructive' });
    await supabase.from('audit_log').insert({ id: crypto.randomUUID(), action: 'USER_REVOKED', entity_type: 'user', entity_id: p.user_id, user_id: 'admin', details: `Revoked access for ${p.email}` });
    toast({ title: 'Access revoked', description: p.email });
    load();
  };

  const softDelete = async (p: PendingProfile) => {
    const { error: e1 } = await supabase.from('profiles').update({ status: 'disabled' as any }).eq('user_id', p.user_id);
    const { error: e2 } = await supabase.from('user_roles').delete().eq('user_id', p.user_id);
    if (e1 || e2) return toast({ title: 'Failed', description: (e1 || e2)?.message, variant: 'destructive' });
    await supabase.from('audit_log').insert({ id: crypto.randomUUID(), action: 'USER_DELETED', entity_type: 'user', entity_id: p.user_id, user_id: 'admin', details: `Soft-deleted ${p.email}` });
    toast({ title: 'User deleted', description: `${p.email} has been disabled.` });
    setConfirmDelete(null);
    load();
  };

  const hardDelete = async (p: PendingProfile) => {
    setHardDeleting(true);
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: p.user_id, email: p.email },
    });
    setHardDeleting(false);
    if (error || (data as any)?.error) {
      return toast({ title: 'Failed', description: error?.message || (data as any)?.error, variant: 'destructive' });
    }
    toast({ title: 'User permanently deleted', description: p.email });
    setConfirmHardDelete(null);
    load();
  };

  const persistRole = async (p: PendingProfile, newRole: string) => {
    const { error: eDel } = await supabase.from('user_roles').delete().eq('user_id', p.user_id);
    if (eDel) return toast({ title: 'Failed', description: eDel.message, variant: 'destructive' });
    const { error: eIns } = await supabase.from('user_roles').insert({ user_id: p.user_id, role: newRole as any });
    if (eIns) return toast({ title: 'Failed', description: eIns.message, variant: 'destructive' });
    await supabase.from('audit_log').insert({
      id: crypto.randomUUID(),
      action: 'USER_ROLE_CHANGED',
      entity_type: 'user',
      entity_id: p.user_id,
      user_id: 'admin',
      details: `Role changed to ${newRole} for ${p.email}`,
    });
    toast({ title: 'Role updated', description: `${p.email} → ${newRole}` });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Registered Users (approval queue)</h3>
        <p className="text-xs text-muted-foreground">New self-registered syndicate users appear here as "pending" until you approve and assign a role. Once approved they move to the <strong>Users</strong> tab.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No registered users yet.</TableCell></TableRow>}
          {rows.map(p => {
            const status = p.status;
            return (
            <TableRow key={p.user_id}>
              <TableCell>{p.email}</TableCell>
              <TableCell>{p.name || '—'}</TableCell>
              <TableCell>{p.organization || '—'}</TableCell>
              <TableCell>
                <Badge variant={status === 'approved' ? 'default' : status === 'rejected' || status === 'disabled' ? 'destructive' : 'secondary'}>
                  {status}
                </Badge>
              </TableCell>
              <TableCell>
                {status === 'disabled' ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <Select
                    value={roleByUser[p.user_id] || 'syndicate_readonly'}
                    onValueChange={(v) => {
                      setRoleByUser(prev => ({ ...prev, [p.user_id]: v }));
                      if (p.status === 'approved') persistRole(p, v);
                    }}
                  >
                    <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell>{lastLoginCell(p)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {status === 'pending' && (
                    <>
                      <Button size="sm" variant="default" onClick={() => approve(p)}><Check className="h-4 w-4 mr-1" />Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(p)}><X className="h-4 w-4 mr-1" />Reject</Button>
                    </>
                  )}
                  {status === 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => revoke(p)}>Revoke access</Button>
                  )}
                  {(status === 'rejected' || status === 'disabled') && (
                    <Button size="sm" variant="default" onClick={() => approve(p)}><Check className="h-4 w-4 mr-1" />Re-approve</Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirmDelete(p)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />Delete user…
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirmHardDelete(p)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />Delete permanently…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable <strong>{confirmDelete?.email}</strong> and revoke all access. The account is kept for audit-log purposes and can be re-approved later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && softDelete(confirmDelete)}
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmHardDelete} onOpenChange={(o) => !o && setConfirmHardDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently remove</strong> <strong>{confirmHardDelete?.email}</strong> — auth account, profile, and roles. This cannot be undone. Audit log entries will remain but reference an orphaned user ID.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={hardDeleting}
              onClick={() => confirmHardDelete && hardDelete(confirmHardDelete)}
            >
              {hardDeleting ? 'Deleting…' : 'Yes, delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}