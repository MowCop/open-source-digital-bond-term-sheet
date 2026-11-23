import { useState } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export interface CopilotCommand {
  id: string; request_text: string; status: string; created_at: string;
  plan: { effects: { location: string; before: string; after: string }[]; warnings: string[]; request: { bulletin?: string } };
}
export default function CopilotCommandPreview({ command, editor, busy, unsaved, onDecide }: { command: CopilotCommand; editor: boolean; busy: boolean; unsaved: boolean; onDecide: (execute: boolean) => void }) {
  const [confirm, setConfirm] = useState(false);
  return <article className="space-y-3 border-l-2 border-primary pl-3 min-w-0" aria-label="Command preview">
    <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold">Command preview</h4><Badge variant="outline">{command.status === 'pending' ? 'Awaiting human Execute' : command.status}</Badge></div>
    <p className="text-sm break-words">{command.request_text}</p>
    <div className="hidden sm:block overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border"><th className="text-left py-1 pr-3">Affected entry</th><th className="text-left pr-3">Before</th><th className="text-left">After Execute</th></tr></thead><tbody>
      {command.plan.effects.map((e, i) => <tr key={i} className="border-b border-border/50"><td className="py-2 pr-3 break-words max-w-64">{e.location}</td><td className="pr-3 align-top break-words">{e.before || 'Empty'}</td><td className="align-top font-medium break-words">{e.after || 'Removed'}</td></tr>)}
    </tbody></table></div>
    <div className="sm:hidden space-y-2 text-xs">{command.plan.effects.map((e,i) => <div key={i} className="border-b border-border pb-2 space-y-1"><p className="break-all font-medium">{e.location}</p><p className="break-words text-muted-foreground">Before: {e.before || 'Empty'}</p><p className="break-words">After Execute: <strong>{e.after || 'Removed'}</strong></p></div>)}</div>
    <div className="space-y-1 text-xs text-warning" role="note">{command.plan.warnings.map((w, i) => <p key={i} className="flex items-start gap-2"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{w}</span></p>)}</div>
    {command.plan.request.bulletin && <details><summary className="text-xs cursor-pointer font-medium">Suggested Send Update text · Draft</summary><p className="mt-2 text-sm whitespace-pre-wrap break-words">{command.plan.request.bulletin}</p></details>}
    {command.status === 'pending' && <>
      {unsaved && <p className="text-xs text-warning">Save or discard unsaved DTS edits before Execute.</p>}
      {!editor && <p className="text-xs text-muted-foreground">Only a term editor can Execute or reject this command.</p>}
      {editor && <div className="flex gap-2"><Button size="sm" disabled={busy || unsaved} onClick={() => setConfirm(true)}><Check className="h-3.5 w-3.5 mr-1" />Execute</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(false)}><X className="h-3.5 w-3.5 mr-1" />Reject</Button></div>}
      <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Execute this command?</AlertDialogTitle><AlertDialogDescription>Save the entries in this preview together, after checking they have not changed. Existing publications and sent alerts remain unchanged. Nothing will be sent.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy || unsaved || !editor} onClick={() => onDecide(true)}>Execute changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>}
  </article>;
}