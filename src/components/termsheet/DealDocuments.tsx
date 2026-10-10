import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  DOCS_CHANGED, deleteDealDocument, listDealDocuments, openDealDocument, type DealDocument,
} from '@/lib/dealDocuments';

const fmtSize = (n: number) => n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;

export default function DealDocuments({ dealId, canManage }: { dealId: string; canManage: boolean }) {
  const [docs, setDocs] = useState<DealDocument[] | null>(null);
  const load = () => listDealDocuments(dealId).then(setDocs).catch(e => { toast.error(e.message); setDocs([]); });
  useEffect(() => {
    load();
    const h = (e: Event) => { if ((e as CustomEvent).detail === dealId) load(); };
    window.addEventListener(DOCS_CHANGED, h);
    return () => window.removeEventListener(DOCS_CHANGED, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const run = (fn: () => Promise<unknown>) => fn().catch((e: Error) => toast.error(e.message));

  if (docs === null) return <p className="text-sm text-muted-foreground">Loading documents…</p>;
  if (!docs.length) return <p className="text-sm text-muted-foreground">No documents yet. Files dropped on this deal are kept here.</p>;
  return (
    <ul className="divide-y rounded-md border">
      {docs.map(d => (
        <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{d.name}</div>
            <div className="text-xs text-muted-foreground">
              {fmtSize(d.size)} · {format(new Date(d.created_at), 'd MMM yyyy HH:mm')}{d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ''}
            </div>
          </div>
          <Button size="icon" variant="ghost" title="Open" onClick={() => run(() => openDealDocument(d.path))}><ExternalLink className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" title="Download" onClick={() => run(() => openDealDocument(d.path, true))}><Download className="h-4 w-4" /></Button>
          {canManage && (
            <Button size="icon" variant="ghost" title="Delete" onClick={() => { if (confirm(`Delete ${d.name}?`)) run(() => deleteDealDocument(d)); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
