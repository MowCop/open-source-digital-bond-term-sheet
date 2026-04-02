import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { UserRole } from '@/types/bond';
import { useToast } from '@/hooks/use-toast';

const roleBadge: Record<UserRole, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  master_admin: { label: 'Master Admin', variant: 'default' },
  syndicate_admin: { label: 'Syndicate Admin', variant: 'secondary' },
  vendor_user: { label: 'Vendor User', variant: 'outline' },
};

export default function AdminPage() {
  const { users, currentUser, addAuditEntry } = useApp();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('vendor_user');

  if (currentUser.role !== 'master_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <Card><CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Access restricted to Master Admins</p>
        </CardContent></Card>
      </div>
    );
  }

  const handleRoleChange = (userId: string) => {
    addAuditEntry({ action: 'USER_ROLE_CHANGED', entityType: 'user', entityId: userId, userId: currentUser.id, details: `Role changed to ${newRole} for ${users.find(u => u.id === userId)?.name}` });
    toast({ title: 'Role Updated', description: `User role has been updated to ${newRole.replace('_', ' ')}` });
    setEditingUser(null);
  };

  const bankUsers = users.filter(u => u.organizationType === 'bank');
  const vendorUsersList = users.filter(u => u.organizationType === 'vendor');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-muted-foreground text-sm">Manage users, roles, and permissions</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{users.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Bank Users</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{bankUsers.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vendor Users</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{vendorUsersList.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Bank Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Organization</TableHead><TableHead>Role</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.organization}</TableCell>
                  <TableCell><Badge variant={roleBadge[user.role].variant}>{roleBadge[user.role].label}</Badge></TableCell>
                  <TableCell>
                    {editingUser === user.id ? (
                      <div className="flex items-center gap-2">
                        <Select value={newRole} onValueChange={v => setNewRole(v as UserRole)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="master_admin">Master Admin</SelectItem>
                            <SelectItem value="syndicate_admin">Syndicate Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => handleRoleChange(user.id)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { setEditingUser(user.id); setNewRole(user.role); }}>Edit Role</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vendor Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Organization</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorUsersList.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.organization}</TableCell>
                  <TableCell><Badge variant="outline">{roleBadge[user.role].label}</Badge></TableCell>
                  <TableCell><Badge className="bg-success text-success-foreground">Active</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
