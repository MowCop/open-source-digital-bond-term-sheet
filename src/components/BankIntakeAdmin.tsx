import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Row = Tables<'bank_intake_requests'>;
export const INTAKE_STATUSES = ['received', 'in_review', 'approved', 'contacted', 'archived'] as const;
const TYPE_LABEL: Record<string, string> = { sdk: 'SDK / Engine', api_mcp: 'API & MCP', vpc: 'Private VPC' };

export function intakeToCsv(rows: Row[]): string {
  const cols: (keyof Row)[] = ['reference', 'created_at', 'status', 'institution', 'contact_name', 'contact_email', 'contact_phone', 'desk_role', 'request_types', 'internal_systems', 'requirements', 'deal_id'];
  const esc = (v: unknown) => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export default function BankIntakeAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [sel, setSel] = useState<Row | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('bank_intake_requests').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message); else setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => rows.filter((r) => {
    const s = q.toLowerCase();
    return (status === 'all' || r.status === status) && (type === 'all' || r.request_types.includes(type))
      && (!s || [r.reference, r.institution, r.contact_name, r.contact_email].some((x) => x?.toLowerCase().includes(s)));
  }), [rows, q, status, type]);

  async function setRowStatus(r: Row, s: string) {
    const { error } = await supabase.from('bank_intake_requests').update({ status: s }).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, status: s } : x)));
    if (sel?.id === r.id) setSel({ ...r, status: s });
  }

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([intakeToCsv(shown)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `bank-intake-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold mr-auto">Bank Enterprise SDK / API requests ({shown.length})</h2>
          <Input className="w-56" placeholder="Search reference, bank, contact" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{INTAKE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
          <Select value={type} onValueChange={setType}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All access types</SelectItem>{Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!shown.length}>Export CSV</Button>
        </div>
        {shown.length === 0 ? <p className="text-sm text-muted-foreground">No requests.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Received</TableHead><TableHead>Institution</TableHead><TableHead>Contact</TableHead><TableHead>Access</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSel(r)}>
                  <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.institution}</TableCell>
                  <TableCell className="text-sm">{r.contact_name}<div className="text-xs text-muted-foreground">{r.contact_email}</div></TableCell>
                  <TableCell className="space-x-1">{r.request_types.map((t) => <Badge key={t} variant="secondary">{TYPE_LABEL[t] ?? t}</Badge>)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select value={r.status} onValueChange={(s) => setRowStatus(r, s)}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{INTAKE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{sel?.institution} — <span className="font-mono">{sel?.reference}</span></DialogTitle></DialogHeader>
          {sel && (
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {([
                ['Status', sel.status], ['Received', new Date(sel.created_at).toLocaleString()], ['Contact', sel.contact_name],
                ['Email', sel.contact_email], ['Phone', sel.contact_phone], ['Desk / role', sel.desk_role],
                ['Access requested', sel.request_types.map((t) => TYPE_LABEL[t] ?? t).join(', ')],
                ['Internal systems', sel.internal_systems.join(', ')], ['Deal', sel.deal_id], ['Requirements', sel.requirements],
              ] as [string, string | null][]).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="col-span-2 whitespace-pre-wrap">{v || '—'}</dd></div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
