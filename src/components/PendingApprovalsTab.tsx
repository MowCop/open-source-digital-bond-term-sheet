import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Check, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, name, organization, status, created_at')
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (p: PendingProfile) => {
    const role = roleByUser[p.user_id] || 'syndicate_readonly';
    const { error: e1 } = await supabase.from('profiles').update({ status: 'approved' }).eq('user_id', p.user_id);
    const { error: e2 } = await supabase.from('user_roles').upsert({ user_id: p.user_id, role: role as any });
    if (e1 || e2) return toast({ title: 'Failed', description: (e1 || e2)?.message, variant: 'destructive' });
    toast({ title: 'Approved', description: `${p.email} as ${role}` });
    load();
  };

  const reject = async (p: PendingProfile) => {
    const { error } = await supabase.from('profiles').update({ status: 'rejected' }).eq('user_id', p.user_id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Registered Users (approval queue)</h3>
        <p className="text-xs text-muted-foreground">New self-registered syndicate users appear here as "pending" until you approve and assign a role.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No registered users yet.</TableCell></TableRow>}
          {rows.map(p => (
            <TableRow key={p.user_id}>
              <TableCell>{p.email}</TableCell>
              <TableCell>{p.name || '—'}</TableCell>
              <TableCell>{p.organization || '—'}</TableCell>
              <TableCell>
                <Badge variant={p.status === 'approved' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {p.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Select value={roleByUser[p.user_id] || 'syndicate_readonly'} onValueChange={(v) => setRoleByUser(prev => ({ ...prev, [p.user_id]: v }))}>
                  <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="default" onClick={() => approve(p)} disabled={p.status === 'approved'}><Check className="h-4 w-4 mr-1" />Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => reject(p)} disabled={p.status === 'rejected'}><X className="h-4 w-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}