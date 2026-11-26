import { useEffect, useState } from 'react';
import { ChevronDown, Download, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  DOCS_CHANGED, deleteDealDocument, listDealDocuments, openDealDocument, type DealDocument,
} from '@/lib/dealDocuments';

const fmtSize = (n: number) => n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;

export default function DealDocuments({ dealId, canManage }: { dealId: string; canManage: boolean }) {
  const [docs, setDocs] = useState<DealDocument[] | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => listDealDocuments(dealId).then(setDocs).catch(e => { toast.error(e.message); setDocs([]); });
  useEffect(() => {
    load();
    const h = (e: Event) => { if ((e as CustomEvent).detail === dealId) load(); };
    window.addEventListener(DOCS_CHANGED, h);
    return () => window.removeEventListener(DOCS_CHANGED, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const run = (fn: () => Promise<unknown>) => fn().catch((e: Error) => toast.error(e.message));
  const sorted = [...(docs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border text-sm">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 font-medium">
        <span>Documents{docs ? ` (${docs.length})` : ''}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {docs === null ? <p className="px-3 pb-2 text-xs text-muted-foreground">Loading…</p>
          : !docs.length ? <p className="px-3 pb-2 text-xs text-muted-foreground">No documents yet.</p>
          : <ul className="max-h-64 overflow-y-auto border-t divide-y">
            {sorted.map(d => (
              <li key={d.id} className="flex items-center gap-1 px-2 py-1">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline"
                  title={`${d.name}\n${fmtSize(d.size)} · ${format(new Date(d.created_at), 'd MMM yyyy HH:mm')}${d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ''}`}
                  onClick={() => run(() => openDealDocument(d.path))}>{d.name}</button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Download" aria-label={`Download ${d.name}`} onClick={() => run(() => openDealDocument(d.path, true))}><Download className="h-3.5 w-3.5" /></Button>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="More"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { if (confirm(`Delete ${d.name}?`)) run(() => deleteDealDocument(d)); }}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>}
      </CollapsibleContent>
    </Collapsible>
  );
}
