import { useState, useRef } from 'react';
import { Message, Attachment } from '@/types/bond';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import LinkifiedText from '@/components/LinkifiedText';
import RichTextEditor from '@/components/RichTextEditor';
import { isHtml } from '@/lib/htmlText';
import { format } from 'date-fns';
import { Edit2, RotateCcw, Save, Send, Trash2, Upload, FileText, Eye, Download, X, ChevronDown, ChevronRight, Users } from 'lucide-react';

interface AlertHistoryCardProps {
  message: Message;
  senderName: string;
  recipientNames: string;
  canManage: boolean;
  versionLabel?: string;
  onUpdate: (id: string, updates: Partial<Message>) => void;
  onRetract: (id: string) => void;
  onSend: (id: string) => void;
  onPostUpdate: (id: string, edits: { subject: string; body: string }) => void;
  onDelete: (id: string) => void;
}

export default function AlertHistoryCard({
  message,
  senderName,
  recipientNames,
  canManage,
  versionLabel,
  onUpdate,
  onRetract,
  onSend,
  onPostUpdate,
  onDelete,
}: AlertHistoryCardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isOpen, setIsOpen] = useState(false);
  const [editSubject, setEditSubject] = useState(message.subject);
  const [editBody, setEditBody] = useState(message.body);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleSave = () => {
    onUpdate(message.id, { subject: editSubject, body: editBody });
    setMode('view');
  };

  const handleSaveAndSend = () => {
    onPostUpdate(message.id, { subject: editSubject, body: editBody });
    setMode('view');
  };

  const enterEdit = () => {
    setMode('edit');
  };

  const handleCancel = () => {
    setEditSubject(message.subject);
    setEditBody(message.body);
    setMode('view');
  };

  const inferType = (name: string): Attachment['type'] => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'pptx' || ext === 'ppt') return 'pptx';
    return 'docx';
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter(f => /\.(pdf|docx?|pptx?)$/i.test(f.name));
    const oversize = accepted.find(f => f.size > 2 * 1024 * 1024);
    if (oversize) {
      alert(`"${oversize.name}" exceeds 2 MB. Files are stored in the browser; use smaller attachments for the prototype.`);
    }
    const newOnes: Attachment[] = await Promise.all(
      accepted.filter(f => f.size <= 2 * 1024 * 1024).map(
        (f) => new Promise<Attachment>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            id: `att${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: f.name,
            type: inferType(f.name),
            size: f.size,
            url: reader.result as string,
          });
          reader.readAsDataURL(f);
        })
      )
    );
    if (newOnes.length > 0) {
      onUpdate(message.id, { attachments: [...message.attachments, ...newOnes] });
    }
  };

  const removeAttachment = (id: string) => {
    onUpdate(message.id, { attachments: message.attachments.filter(a => a.id !== id) });
  };

  const downloadAttachment = (a: Attachment) => {
    const link = document.createElement('a');
    link.href = a.url;
    link.download = a.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;

  const isRetracted = message.status === 'retracted';
  const isSent = message.status === 'sent';
  const isDraft = message.status === 'draft';
  const editing = mode !== 'view';
  const bodyHasHtml = isHtml(message.body);

  return (
    <>
    <div className={`rounded-lg border border-border bg-card/60 p-4 space-y-3 ${isRetracted ? 'opacity-50' : ''}`}>
      {/* Header row */}
      <div
        className="flex items-start justify-between gap-4 cursor-pointer hover:bg-card/80 rounded -m-1 p-1 transition-colors"
        onClick={() => setIsOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(o => !o);
          }
        }}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="mt-0.5 text-muted-foreground shrink-0">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
              {versionLabel && (
                <span className="text-[10px] font-semibold uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  {versionLabel}
                </span>
              )}
              <span className="truncate">{message.subject}</span>
            </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{senderName}</span>
          </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-timestamp text-xs whitespace-nowrap">
            {versionLabel ? `${versionLabel} · ` : ''}{format(message.updatedAt, 'MMM d, hh:mm a')}
          </span>
          <Badge
            variant={isSent ? 'default' : isDraft ? 'secondary' : 'destructive'}
            className="text-[10px]"
          >
            {message.status}
          </Badge>
        </div>
      </div>

      {isOpen && (
      <>
      {/* Body */}
      {bodyHasHtml ? (
        <div
          className="tiptap prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: message.body }}
        />
      ) : (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap"><LinkifiedText text={message.body} /></div>
      )}

      {/* Distribution List (vendor recipients) */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <Users className="h-3 w-3" />
          <span>Distribution ({message.recipients.length} recipient{message.recipients.length !== 1 ? 's' : ''})</span>
          <ChevronDown className="h-3 w-3" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 pl-5 text-xs text-muted-foreground">
          {recipientNames || '(no recipients)'}
        </CollapsibleContent>
      </Collapsible>

      {/* Attachments panel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attachments ({message.attachments.length})
          </div>
          {canManage && !isRetracted && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              />
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> Add files
              </Button>
            </>
          )}
        </div>
        {canManage && !isRetracted && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={`border border-dashed rounded p-2 text-center text-xs text-muted-foreground transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            Drop PDF, DOCX, or PPTX here
          </div>
        )}
        {message.attachments.length > 0 && (
          <div className="space-y-1">
            {message.attachments.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs bg-background border border-border rounded px-2 py-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPreviewAttachment(a)} title="Preview">
                  <Eye className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadAttachment(a)} title="Download">
                  <Download className="h-3 w-3" />
                </Button>
                {canManage && !isRetracted && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeAttachment(a.id)} title="Remove">
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewAttachment} onOpenChange={(o) => !o && setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewAttachment?.name}</DialogTitle>
          </DialogHeader>
          {previewAttachment?.type === 'pdf' ? (
            <iframe src={previewAttachment.url} className="flex-1 w-full border border-border rounded" title={previewAttachment.name} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <FileText className="h-12 w-12" />
              <div>Inline preview unavailable for this file type.</div>
              {previewAttachment && (
                <Button onClick={() => downloadAttachment(previewAttachment)}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action buttons */}
      {canManage && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/50 flex-wrap">
            <>
              {!isRetracted && (
                <Button size="sm" variant="outline" className="text-xs" onClick={enterEdit}>
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
              {(isSent || isDraft) && !isRetracted && (
                <Button size="sm" variant="destructive" className="text-xs" onClick={() => onRetract(message.id)}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retract
                </Button>
              )}
              {isDraft && !isRetracted && (
                <Button size="sm" className="text-xs" onClick={() => onSend(message.id)}>
                  <Send className="h-3 w-3 mr-1" />
                  Send
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-xs ml-auto" onClick={() => {
                if (confirm(`Delete this alert "${message.subject}"? This cannot be undone.`)) onDelete(message.id);
              }}>
                <Trash2 className="h-3 w-3 mr-1 text-destructive" />
                Delete
              </Button>
            </>
        </div>
      )}
      </>
      )}
    </div>

    {/* Full-screen edit modal */}
    <Dialog
      open={editing}
      onOpenChange={(o) => { if (!o) handleCancel(); }}
    >
      <DialogContent
        className="max-w-[96vw] w-[96vw] h-[94vh] sm:rounded-lg p-0 gap-0 flex flex-col"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">Edit alert</DialogTitle>
          <input
            value={editSubject}
            onChange={e => setEditSubject(e.target.value)}
            placeholder="Subject"
            className="mt-3 w-full bg-background border border-border rounded px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </DialogHeader>

        <div className="flex-1 min-h-0 px-5 py-4">
          <RichTextEditor
            value={editBody}
            onChange={setEditBody}
            placeholder="Write the alert body…"
            className="h-full"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0 bg-card/40">
          <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
          <Button variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          {isSent && !isRetracted && (
            <Button onClick={handleSaveAndSend}>
              <Send className="h-4 w-4 mr-1" /> Save &amp; Send
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
