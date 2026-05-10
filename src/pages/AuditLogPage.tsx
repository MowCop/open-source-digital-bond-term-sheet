import { useApp, useScopedApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { format } from 'date-fns';
import { Search } from 'lucide-react';

const actionColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DEAL_CREATED: 'default',
  DEAL_STAGE_CHANGED: 'secondary',
  DEAL_PRICED: 'default',
  MESSAGE_CREATED: 'outline',
  MESSAGE_SENT: 'default',
  MESSAGE_RETRACTED: 'destructive',
  USER_ROLE_CHANGED: 'secondary',
};

export default function AuditLogPage() {
  const scoped = useScopedApp();
  const { users } = useApp();
  const auditLog = scoped.auditLog;
  const { authUser } = useAuth();
  const isMaster = authUser?.email?.toLowerCase() === 'karl.mallalieu@gmail.com';
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = auditLog
    .filter(e => isMaster || (e.entityType as string) !== 'master_admin')
    .filter(e => filterType === 'all' || e.entityType === filterType)
    .filter(e => !search || e.details.toLowerCase().includes(search.toLowerCase()) || e.action.toLowerCase().includes(search.toLowerCase()));

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm">Complete trail of all system actions for compliance</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search audit log..." className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="deal">Deals</SelectItem>
            <SelectItem value="message">Messages</SelectItem>
            <SelectItem value="user">Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{filtered.length} entries</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(entry.timestamp, 'MMM d, yyyy HH:mm:ss')}</TableCell>
                  <TableCell><Badge variant={actionColors[entry.action] || 'outline'} className="text-xs">{entry.action.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="capitalize text-sm">{entry.entityType}</TableCell>
                  <TableCell className="text-sm">{getUserName(entry.userId)}</TableCell>
                  <TableCell className="text-sm max-w-md truncate">{entry.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
