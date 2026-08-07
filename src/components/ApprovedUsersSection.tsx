import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import RoleBadge from '@/components/RoleBadge';
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

interface ApprovedProfile {
  user_id: string;
  email: string;
  name: string | null;
  organization: string | null;
  created_at: string;
  status: string;
}

interface Props {
  title?: string;
  subtitle?: string;
  onOpenProfile?: (email: string, name?: string) => void;
  reloadKey?: number;
}

export default function ApprovedUsersSection({
  title = 'Login Users (self-registered)',
  subtitle = 'People who signed up. An orange dot means their registration is awaiting approval — open their Profile to approve or reject. This is separate from the Address Book below.',
  onOpenProfile,
  reloadKey = 0,
}: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ApprovedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({});
  const [confirmRevoke, setConfirmRevoke] = useState<ApprovedProfile | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, name, organization, created_at, status')
      .in('status', ['approved', 'pending'])
      .order('name', { ascending: true, nullsFirst: false });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    const profiles = (data as any[]) ?? [];
    setRows(profiles as any);
    const ids = profiles.map((p: any) => p.user_id);
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
    setLoading(false);
  };

  useEffect(() => { load(); }, [reloadKey]);

  const persistRole = async (p: ApprovedProfile, newRole: string) => {
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

  const revoke = async (p: ApprovedProfile) => {
    const { error: e1 } = await supabase.from('profiles').update({ status: 'rejected' }).eq('user_id', p.user_id);
    const { error: e2 } = await supabase.from('user_roles').delete().eq('user_id', p.user_id);
    if (e1 || e2) return toast({ title: 'Failed', description: (e1 || e2)?.message, variant: 'destructive' });
    await supabase.from('audit_log').insert({
      id: crypto.randomUUID(),
      action: 'USER_REVOKED',
      entity_type: 'user',
      entity_id: p.user_id,
      user_id: 'admin',
      details: `Revoked access for ${p.email}`,
    });
    toast({ title: 'Access revoked', description: `${p.email} moved back to Pending Approvals.` });
    setConfirmRevoke(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Name & Contact</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-center">Profile</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Organization</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No registered users yet.</TableCell></TableRow>}
          {rows.map(p => (
            <TableRow key={p.user_id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name || '—'}</span>
                  {p.status === 'pending' && (
                    <span
                      title="Awaiting approval"
                      aria-label="Awaiting approval"
                      className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500"
                    />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
              </TableCell>
              <TableCell className="text-center">
                <div className="inline-flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Open profile for ${p.email}`}
                    onClick={() => onOpenProfile?.(p.email, p.name)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {p.status === 'pending' && (
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" title="Awaiting approval" />
                  )}
                </div>
              </TableCell>
              <TableCell>{p.organization || '—'}</TableCell>
              <TableCell>
                <RoleBadge role={roleByUser[p.user_id]} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!confirmRevoke} onOpenChange={(o) => !o && setConfirmRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this user's access?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmRevoke?.email}</strong> will lose access and reappear in the Pending Approvals tab where you can re-approve them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmRevoke && revoke(confirmRevoke)}
            >
              Yes, revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}