import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncAuditRow {
  id: string;
  source: string;
  repo: string | null;
  event_type: string;
  status: string;
  records_processed: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  triggered_by: string | null;
  created_at: string;
}

export default function SyncAuditLogPage() {
  const [rows, setRows] = useState<SyncAuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sync_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) setRows(data as SyncAuditRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sources = Array.from(new Set(rows.map(r => r.source)));
  const filtered = rows
    .filter(r => sourceFilter === 'all' || r.source === sourceFilter)
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (r.error_message ?? '').toLowerCase().includes(q)
        || JSON.stringify(r.details ?? {}).toLowerCase().includes(q)
        || (r.repo ?? '').toLowerCase().includes(q);
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sync Audit Log</h1>
          <p className="text-muted-foreground text-sm">Every data sync attempt, plus any errors, from external sources into this app.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search errors, details, repo..." className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{filtered.length} entries</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No sync events yet. Events will appear here as external syncs run.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Repo</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead>Error / Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_at), 'MMM d, yyyy HH:mm:ss')}</TableCell>
                    <TableCell className="text-sm">{r.source}</TableCell>
                    <TableCell className="text-sm">{r.repo ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.event_type.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'success' ? 'default' : 'destructive'} className="text-xs">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.records_processed ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-md truncate">
                      {r.error_message ?? (r.details ? JSON.stringify(r.details) : '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}