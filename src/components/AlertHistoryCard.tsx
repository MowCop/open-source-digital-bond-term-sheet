import { useState, useRef, useEffect } from 'react';
import { Message, Attachment } from '@/types/bond';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import LinkifiedText from '@/components/LinkifiedText';
import RichTextEditor from '@/components/RichTextEditor';
import { isHtml } from '@/lib/htmlText';
import { format } from 'date-fns';
import { Edit2, RotateCcw, Save, Send, Trash2, Upload, FileText, Eye, Download, X, ChevronDown, ChevronRight, Users, ArrowLeft, ChevronUp } from 'lucide-react';
import PdfEditor from '@/components/PdfEditor';
import DOMPurify from 'dompurify';
import SecureChat from '@/components/SecureChat';
import { useApp } from '@/context/AppContext';
import type { DealStage } from '@/types/bond';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

const editStageColor: Record<DealStage, string> = {
  Mandate: 'bg-blue-100 text-blue-800',
  Announced: 'bg-blue-100 text-blue-800',
  Launched: 'bg-green-100 text-green-800',
  'Books Open': 'bg-green-100 text-green-800',
  'Books Closed': 'bg-green-100 text-green-800',
  Priced: 'bg-amber-100 text-amber-800',
  Settled: 'bg-amber-100 text-amber-800',
};

const ALLOWED_TAGS = ['p','br','strong','em','u','s','h1','h2','h3','h4','ul','ol','li','blockquote','a','img','table','thead','tbody','tr','td','th','code','pre','span','div'];
const ALLOWED_ATTR = ['href','target','rel','src','alt','title','class','colspan','rowspan'];
const sanitizeHtml = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, FORBID_TAGS: ['script','style','iframe','object','embed'], FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus'] });

interface AlertHistoryCardProps {
  message: Message;
  senderName: string;
  recipientNames: string;
  canManage: boolean;
  versionLabel?: string;
  isLatest?: boolean;
  editSignal?: number;
  /**
   * When true, render the card without its own header chrome (chevron,
   * version chip, sender, timestamp, status badge) and skip the outer
   * border/padding. Used when the parent row already shows that metadata
   * (e.g. the merged headline row on the Issue Board) so we don't duplicate.
   * Body, attachments, and action buttons render inline; the card is always
   * expanded.
   */
  embedded?: boolean;
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
  isLatest = false,
  editSignal = 0,
  embedded = false,
  onUpdate,
  onRetract,
  onSend,
  onPostUpdate,
  onDelete,
}: AlertHistoryCardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedOverride, setCollapsedOverride] = useState(false);
  const expanded = embedded ? true : (collapsedOverride ? false : (isOpen || isLatest));
  const [editSubject, setEditSubject] = useState(message.subject);
  const [editBody, setEditBody] = useState(message.body);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clickEditTimerRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [bulletinOpen, setBulletinOpen] = useState(true);
  const { deals } = useApp();
  const editDeal = message.dealIds?.[0]
    ? deals.find(d => d.id === message.dealIds[0]) || null
    : null;

  const clearClickEditTimer = () => {
    if (clickEditTimerRef.current) {
      window.clearTimeout(clickEditTimerRef.current);
      clickEditTimerRef.current = null;
    }
  };

  useEffect(() => clearClickEditTimer, []);

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

  // Open the editor when the parent fires an external edit signal (latest card only).
  useEffect(() => {
    if (editSignal && editSignal > 0 && canManage && message.status !== 'retracted') {
      setEditSubject(message.subject);
      setEditBody(message.body);
      setMode('edit');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSignal]);

  // Esc collapses any expanded alert card (including the force-expanded
  // latest one). Skip when the edit modal is open — Radix Dialog owns Esc.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (mode === 'edit') {
        // Editor open → close the editor and bubble up to collapse the deal row
        // so a single Esc returns the user to the Issue Board.
        e.stopPropagation();
        attemptClose();
      } else {
        setIsOpen(false);
        setCollapsedOverride(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, mode]);

  // Reset collapse override when the underlying message changes (e.g. a new
  // latest version is created), so the new latest expands by default.
  useEffect(() => {
    setCollapsedOverride(false);
  }, [message.id]);

  const handleCancel = () => {
    setEditSubject(message.subject);
    setEditBody(message.body);
    setMode('view');
  };

  const isDirty = editSubject !== message.subject || editBody !== message.body;

  const attemptClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard and return to the Issue Board?')) {
      return;
    }
    handleCancel();
    // Signal parent (MessagesPage) to also collapse the deal row so a single
    // Esc inside the editor returns the user all the way to the Issue Board.
    window.dispatchEvent(new CustomEvent('alert-editor-closed'));
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

  const toggleExpanded = () => {
    if (expanded) {
      setIsOpen(false);
      setCollapsedOverride(true);
    } else {
      setIsOpen(true);
      setCollapsedOverride(false);
    }
  };

  const isRetracted = message.status === 'retracted';
  const isSent = message.status === 'sent';
  const isDraft = message.status === 'draft';
  const editing = mode !== 'view';
  const bodyHasHtml = isHtml(message.body);
  const latestEditable = isLatest && canManage && !isRetracted;

  return (
    <>
    <div
      data-alert-card-expanded={expanded ? 'true' : undefined}
      className={
        embedded
          ? `space-y-3 ${isRetracted ? 'opacity-50' : ''} ${latestEditable ? 'cursor-pointer rounded-md border border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 hover:ring-1 hover:ring-primary/20 -mx-2 px-3 py-2 transition-colors' : ''}`
          : `rounded-lg border bg-card/60 p-4 space-y-3 ${isLatest ? 'border-2 border-white shadow-[0_0_0_1px_hsl(var(--background))]' : 'border-border'} ${isRetracted ? 'opacity-50' : ''} ${latestEditable ? 'cursor-pointer hover:bg-card/80 transition-colors' : ''}`
      }
      title={latestEditable ? 'Click anywhere to edit — Esc to close' : undefined}
      onClick={latestEditable && expanded ? (e) => {
        // Trackpads emit the first tap as a normal click before the browser
        // knows whether a double-click is coming. Delay edit mode briefly so
        // the second tap can cancel it and close the panel instead.
        clearClickEditTimer();
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
        if (e.detail > 1) return;
        clickEditTimerRef.current = window.setTimeout(() => {
          clickEditTimerRef.current = null;
          enterEdit();
        }, 450);
      } : undefined}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
        clearClickEditTimer();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('alert-editor-closed'));
      }}
    >
      {/* Header row — hidden when embedded (parent renders this metadata) */}
      {!embedded && (
      <div
        className={`flex items-start justify-between gap-4 rounded -m-1 p-1 transition-colors ${latestEditable && expanded ? '' : 'cursor-pointer hover:bg-card/80'}`}
        onClick={latestEditable && expanded ? undefined : (e) => { e.stopPropagation(); toggleExpanded(); }}
        role={latestEditable && expanded ? undefined : 'button'}
        tabIndex={latestEditable && expanded ? undefined : 0}
        onKeyDown={latestEditable && expanded ? undefined : (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="mt-0.5 text-muted-foreground shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="flex-1 min-w-0">
            {versionLabel && (
              <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  {versionLabel}
                </span>
              </div>
            )}
            {message.subject && (
              <div className="mt-1 text-sm font-medium text-foreground truncate">
                {message.subject}
              </div>
            )}
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
      )}

      {expanded && (
      <>
      {latestEditable && embedded && (
        <div className="flex items-center justify-end -mt-1">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Edit2 className="h-3 w-3" />
            Click anywhere to edit
          </span>
        </div>
      )}
      {/* Body */}
      {bodyHasHtml ? (
        <div
          className="tiptap prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.body) }}
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
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
            <DialogTitle>{previewAttachment?.name}</DialogTitle>
          </DialogHeader>
          {previewAttachment?.type === 'pdf' ? (
            <div className="flex-1 min-h-0 relative">
              <PdfEditor attachment={previewAttachment} canEdit={canManage && !isRetracted} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground p-6">
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
              {!isRetracted && !isLatest && (
                <Button size="sm" variant="outline" className="text-xs" onClick={enterEdit}>
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
              {(isSent || isDraft) && !isRetracted && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs"
                  disabled={isDraft}
                  title={isDraft ? 'Retract is only available for Published alerts' : undefined}
                  onClick={() => onRetract(message.id)}
                >
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
              {!(isLatest && embedded) && (
                <Button size="sm" variant="outline" className="text-xs ml-auto" onClick={() => {
                  if (confirm(`Delete this alert "${message.subject}"? This cannot be undone.`)) onDelete(message.id);
                }}>
                  <Trash2 className="h-3 w-3 mr-1 text-destructive" />
                  Delete
                </Button>
              )}
            </>
        </div>
      )}
      </>
      )}
    </div>

    {/* Full-screen edit modal */}
    <Dialog
      open={editing}
      onOpenChange={(o) => { if (!o) attemptClose(); }}
    >
      <DialogContent
        className="max-w-[96vw] w-[96vw] h-[94vh] sm:rounded-lg p-0 gap-0 flex flex-col"
      >
        <DialogHeader className="px-5 pt-2 pb-1 border-b border-border shrink-0 space-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={attemptClose}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back to Issue Board
            </button>
            {editDeal && (
              <Badge className={`text-[10px] mr-8 ${editStageColor[editDeal.stage]}`}>
                {editDeal.stage}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-base">Edit alert</DialogTitle>
          <input
            value={editSubject}
            onChange={e => setEditSubject(e.target.value)}
            placeholder="Subject"
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {bulletinOpen && chatOpen ? (
            <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
              <ResizablePanel defaultSize={42} minSize={0} collapsible collapsedSize={0}>
                <div className="h-full px-5 pt-3 pb-2 flex flex-col min-h-0">
                  <button
                    type="button"
                    onClick={() => setBulletinOpen(false)}
                    aria-expanded={bulletinOpen}
                    className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Collapse bulletin"
                  >
                    <span>Bulletin</span>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex-1 min-h-0">
                    <RichTextEditor
                      value={editBody}
                      onChange={setEditBody}
                      placeholder="Write the alert body…"
                      className="h-full"
                    />
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={58} minSize={10}>
                <div className="h-full border-t border-border bg-muted/20 flex flex-col min-h-0">
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    aria-expanded={chatOpen}
                    className="flex items-center justify-between gap-2 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors shrink-0"
                  >
                    <span>Associated Chat Thread</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex-1 min-h-0 px-5 pb-3">
                    <SecureChat
                      key={message.dealIds?.[0] ?? 'no-deal'}
                      activeDealId={message.dealIds?.[0] ?? null}
                      heightClass="h-full"
                      allowDealAccess
                      hideStageBadge
                      fallbackThreadLabel={message.subject}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <>
              {/* Bulletin (collapsed header bar when chat fills) or full bulletin when chat collapsed */}
              <div className={bulletinOpen ? 'flex-1 min-h-0 px-5 pt-3 pb-2 flex flex-col' : 'shrink-0'}>
                <button
                  type="button"
                  onClick={() => setBulletinOpen(o => !o)}
                  aria-expanded={bulletinOpen}
                  className={`flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors shrink-0 ${bulletinOpen ? 'mb-2' : 'px-5 py-2 w-full hover:bg-muted/30'}`}
                >
                  <span>Bulletin</span>
                  {bulletinOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {bulletinOpen && (
                  <div className="flex-1 min-h-0">
                    <RichTextEditor
                      value={editBody}
                      onChange={setEditBody}
                      placeholder="Write the alert body…"
                      className="h-full"
                    />
                  </div>
                )}
              </div>

              <div className={`border-t border-border bg-muted/20 flex flex-col min-h-0 ${chatOpen ? 'flex-1' : 'shrink-0'}`}>
                <button
                  type="button"
                  onClick={() => setChatOpen(o => !o)}
                  aria-expanded={chatOpen}
                  className="flex items-center justify-between gap-2 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors shrink-0"
                >
                  <span>Associated Chat Thread</span>
                  {chatOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </button>
                {chatOpen && (
                  <div className="flex-1 min-h-0 px-5 pb-3">
                    <SecureChat
                      key={message.dealIds?.[0] ?? 'no-deal'}
                      activeDealId={message.dealIds?.[0] ?? null}
                      heightClass="h-full"
                      allowDealAccess
                      hideStageBadge
                      fallbackThreadLabel={message.subject}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Attachments panel */}
        <div className="px-5 pb-2 space-y-1.5 border-t border-border shrink-0">
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attachments ({message.attachments.length})
            </div>
            {!isRetracted && (
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> Add files
              </Button>
            )}
          </div>
          {!isRetracted && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                className={`border border-dashed rounded px-2 py-1.5 text-center text-xs text-muted-foreground transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              Drop PDF, DOCX, or PPTX here
            </div>
          )}
          {message.attachments.length > 0 && (
            <div className="space-y-1 max-h-20 overflow-y-auto">
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
                  {!isRetracted && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeAttachment(a.id)} title="Remove">
                      <X className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-2 border-t border-border shrink-0 bg-card/40">
          <Button variant="ghost" onClick={attemptClose}>Cancel</Button>
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
