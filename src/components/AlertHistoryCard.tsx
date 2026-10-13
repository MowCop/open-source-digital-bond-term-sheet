import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message, Attachment } from '@/types/bond';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import LinkifiedText from '@/components/LinkifiedText';
import RichTextEditor from '@/components/RichTextEditor';
import { isHtml } from '@/lib/htmlText';
import { demoBoardBody } from '@/data/alRajhiDemo';
import { dtsLink } from '@/lib/dtsNavigation';
import { formatUTCDateTime } from '@/lib/utils';
import { Edit2, RotateCcw, Save, Send, Trash2, Upload, FileText, Eye, Download, X, ChevronDown, ChevronRight, Users, ArrowLeft, ChevronUp, MessageSquare, BookOpen, Minus, ShieldCheck, Sparkles } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import ExtractDealFromChatButton from '@/components/ExtractDealFromChatButton';
import { useToast } from '@/hooks/use-toast';
import PdfEditor from '@/components/PdfEditor';
import DOMPurify from 'dompurify';
import SecureChat from '@/components/SecureChat';
import { useApp } from '@/context/AppContext';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import DealChecker, { DealCheckerLogo } from '@/components/DealChecker';
import DealCheckFlag from '@/components/DealCheckFlag';
import DraggablePanel from '@/components/DraggablePanel';

const ALLOWED_TAGS = ['p','br','strong','em','u','s','h1','h2','h3','h4','ul','ol','li','blockquote','a','img','table','thead','tbody','tr','td','th','code','pre','span','div'];
const ALLOWED_ATTR = ['href','target','rel','src','alt','title','class','colspan','rowspan'];
const sanitizeHtml = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, FORBID_TAGS: ['script','style','iframe','object','embed'], FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus'] });

interface AlertHistoryCardProps {
  message: Message;
  senderName: string;
  recipientNames: string;
  canManage: boolean;
  /** Archive update (already sent and superseded) — view only, no editing. */
  readOnly?: boolean;
  versionLabel?: string;
  /** All alert versions for this deal, newest first (for the version dropdown). */
  versions?: Message[];
  /** Id of the version that should be editable (defaults to the newest version). */
  editableVersionId?: string;
  isLatest?: boolean;
  editSignal?: number;
  saveSignal?: number;
  saveSendSignal?: number;
  /**
   * When true, render the card without its own header chrome (chevron,
   * version chip, sender, timestamp, status badge) and skip the outer
   * border/padding. Used when the parent row already shows that metadata
   * (e.g. the merged headline row on the Issue Board) so we don't duplicate.
   * Body, attachments, and action buttons render inline; the card is always
   * expanded.
   */
  embedded?: boolean;
  /** Unread chat count for this deal, shown on the edit-screen Chat icon. */
  chatUnread?: number;
  /** True when the deal chat is already open on the board; keeps it open in edit. */
  chatOpenOnBoard?: boolean;
  /** Open the card body by default (e.g. full history expansion on the board). */
  defaultExpanded?: boolean;
  /**
   * When true, render only the full-screen editor dialog. Used when the
   * card is opened directly from the New Issue Board as the primary edit/archive
   * overlay, replacing the previous Focus Mode intermediate view.
   */
  fullscreen?: boolean;
  /** Called when the fullscreen dialog is closed (Esc, back arrow, click outside). */
  onClose?: () => void;
  onUpdate: (id: string, updates: Partial<Message>) => void;
  onRetract: (id: string) => void;
  onSend: (id: string) => void;
  onPostUpdate: (id: string, edits: { subject: string; body: string }) => void;
  onDelete: (id: string) => void;
}

export default function AlertHistoryCard({
  message: sourceMessage,
  senderName,
  recipientNames,
  canManage: canManageProp,
  readOnly = false,
  versionLabel,
  versions: sourceVersions,
  editableVersionId,
  isLatest = false,
  editSignal = 0,
  saveSignal = 0,
  saveSendSignal = 0,
  embedded = false,
  chatUnread = 0,
  chatOpenOnBoard = false,
  defaultExpanded = false,
  fullscreen = false,
  onClose,
  onUpdate,
  onRetract,
  onSend,
  onPostUpdate,
  onDelete,
}: AlertHistoryCardProps) {
  const message = { ...sourceMessage, body: demoBoardBody(sourceMessage.id, sourceMessage.body) };
  const versions = sourceVersions?.map(m => ({ ...m, body: demoBoardBody(m.id, m.body) }));

function BackButtonTooltip({ label, onClick }: { label: string; onClick: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={label}
          className="toolbar-square-btn"
          onClick={onClick}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

  // Only the latest, non-read-only version is editable. Archive versions and
  // any version selected from the dropdown that is not the newest are view-only.
  const latestVersionId = editableVersionId ?? versions?.[0]?.id ?? message.id;
  const canManageLatest = canManageProp && !readOnly;
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedOverride, setCollapsedOverride] = useState(false);
  const expanded = embedded ? true : (collapsedOverride ? false : (isOpen || isLatest || defaultExpanded));
  const [editSubject, setEditSubject] = useState(message.subject);
  const [editBody, setEditBody] = useState(message.body);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clickEditTimerRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [docsOpen, setDocsOpen] = useState(true);
  const [checkerOpen, setCheckerOpen] = useState(false);
  const [parseOpen, setParseOpen] = useState(false);
  const [parseSources, setParseSources] = useState<{ chat: boolean; docs: boolean }>({ chat: true, docs: false });
  const [parseRunSignal, setParseRunSignal] = useState(0);
  const [attachmentsHover, setAttachmentsHover] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { deals, currentUser } = useApp();
  const editDeal = message.dealIds?.[0]
    ? deals.find(d => d.id === message.dealIds[0]) || null
    : null;

  const toggleParseSource = (key: 'chat' | 'docs') => {
    setParseSources(cur => {
      const next = { ...cur, [key]: !cur[key] };
      if (!next.chat && !next.docs) next[key] = true;
      return next;
    });
    if (key === 'docs') {
      toast({ title: 'Docs parsing coming soon', description: 'Document parsing is not live yet — the chat thread is used for extraction.' });
    }
  };

  const clearClickEditTimer = () => {
    if (clickEditTimerRef.current) {
      window.clearTimeout(clickEditTimerRef.current);
      clickEditTimerRef.current = null;
    }
  };

  useEffect(() => clearClickEditTimer, []);

  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [viewVersionId, setViewVersionId] = useState<string | null>(null);

  // All published versions of this deal, newest first, labelled Update #N … Original.
  const versionOptions = (() => {
    const list = (versions && versions.length ? versions : [message]).slice();
    const total = list.length;
    return list.map((m, i) => ({
      message: m,
      label: i === total - 1 ? 'Original' : `Update #${total - 1 - i}`,
    }));
  })();
  const activeVersion = versionOptions.find(v => v.message.id === viewVersionId)?.message ?? message;
  // The newest version in the deal thread is the editable one; every earlier
  // sent version is an archive record.
  const viewingArchive = activeVersion.id !== latestVersionId;
  const canManage = canManageLatest && !viewingArchive;
  const activeVersionLabel =
    versionOptions.find(v => v.message.id === activeVersion.id)?.label ?? versionLabel;

  // Keep local draft in sync with the active version while not editing, so an
  // external Save never writes back stale content (e.g. after an inline
  // headline rename on the board or switching versions in the dropdown).
  useEffect(() => {
    if (mode === 'view') {
      setEditSubject(activeVersion.subject);
      setEditBody(activeVersion.body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVersion.subject, activeVersion.body, mode, activeVersion.id]);

  // Reset draft to the selected version whenever the user switches versions,
  // regardless of current mode, so the editor always reflects what is being viewed.
  useEffect(() => {
    setEditSubject(activeVersion.subject);
    setEditBody(activeVersion.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVersion.id]);

  // Any further edit re-enables Save.
  useEffect(() => { setIsSaved(false); }, [editSubject, editBody]);

  // When the parent switches the message prop (e.g. after Save & Send creates a
  // new latest update), drop any explicit version selection so the new message
  // becomes the active version.
  useEffect(() => {
    setViewVersionId(null);
  }, [message.id]);


  const handleSave = () => {
    onUpdate(activeVersion.id, { subject: editSubject, body: editBody });
    if (!fullscreen) setMode('view');
  };

  const handleSaveAndSend = () => {
    onPostUpdate(activeVersion.id, { subject: editSubject, body: editBody });
    if (!fullscreen) setMode('view');
  };

  const enterEdit = () => {
    setMode('edit');
  };

  // Open the editor when the parent fires an external edit signal (latest card only).
  useEffect(() => {
    if (editSignal && editSignal > 0 && canManage && activeVersion.status !== 'retracted') {
      setEditSubject(activeVersion.subject);
      setEditBody(activeVersion.body);
      setMode('edit');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSignal]);

  // External Save / Save & Send triggers from the deal toolbar.
  useEffect(() => {
    if (saveSignal > 0 && canManage && activeVersion.status !== 'retracted') handleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal]);

  useEffect(() => {
    if (saveSendSignal > 0 && canManage && activeVersion.status !== 'retracted') handleSaveAndSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSendSignal]);

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
    setEditSubject(activeVersion.subject);
    setEditBody(activeVersion.body);
    if (!fullscreen) setMode('view');
  };

  const isDirty = editSubject !== activeVersion.subject || editBody !== activeVersion.body;

  const attemptClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard and return to the Issue Board?')) {
      return;
    }
    handleCancel();
    if (fullscreen && onClose) {
      onClose();
    } else {
      // Signal parent (MessagesPage) to also collapse the deal row so a single
      // Esc inside the editor returns the user all the way to the Issue Board.
      window.dispatchEvent(new CustomEvent('alert-editor-closed'));
    }
  };

  const handleBackToMenu = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard and return to Main Menu?')) {
      return;
    }
    handleCancel();
    navigate('/messages');
  };

  const handleBack = () => {
    if (fullscreen && onClose) {
      if (isDirty && !window.confirm('You have unsaved changes. Discard and return to the Issue Board?')) {
        return;
      }
      handleCancel();
      onClose();
    } else {
      handleBackToMenu();
    }
  };

  const inferType = (name: string): Attachment['type'] => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'pptx' || ext === 'ppt') return 'pptx';
    return 'docx';
  };

  const dragDepth = useRef(0);
  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  const dropZoneProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
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
  // Carry the board's open chat into the edit screen.
  useEffect(() => {
    if (editing && chatOpenOnBoard) {
      setChatOpen(true);
      setChatMinimized(false);
    }
  }, [editing, chatOpenOnBoard]);
  const bodyHasHtml = isHtml(message.body);
  const latestEditable = isLatest && canManage && !isRetracted;

  return (
    <>
    {!fullscreen && (
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
                <span className="text-[11px] font-bold uppercase text-sky-300 bg-sky-400/15 px-2 py-0.5 rounded whitespace-nowrap shadow-[0_0_6px_rgba(125,211,252,0.35)]">
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
            {versionLabel ? `${versionLabel} · ` : ''}{formatUTCDateTime(message.updatedAt)} <span className="text-[9px] text-white/70">UTC</span>
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
          className="alert-message-body tiptap prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground"
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
      <div
        className="space-y-1.5"
        onMouseEnter={() => setAttachmentsHover(true)}
        onMouseLeave={() => setAttachmentsHover(false)}
        {...dropZoneProps}
      >

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            Attachments ({message.attachments.length})
          </span>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Add files</TooltipContent>
              </Tooltip>
              {(attachmentsHover || dragOver) && (
                <div
                  onClick={() => fileInputRef.current?.click()}

                  className={`flex-1 border border-dashed rounded px-2 py-1 text-center text-xs text-muted-foreground transition-colors cursor-pointer hover:border-primary hover:bg-primary/5 ${dragOver ? 'border-primary bg-primary/10' : 'border-border'}`}
                >
                  Drop PDF, DOCX, or PPTX here
                </div>
              )}
            </>
          )}
        </div>
        {message.attachments.length > 0 && (
          <div className="flex flex-col gap-1">
            {message.attachments.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs bg-background border border-border rounded px-2 py-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPreviewAttachment(a)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Preview</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadAttachment(a)}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Download</TooltipContent>
                </Tooltip>
                {canManage && !isRetracted && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeAttachment(a.id)}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Remove</TooltipContent>
                  </Tooltip>
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
        <div className="relative flex items-center justify-between gap-2 pt-2 pb-1 px-5 border-t border-border/50">
          <div className="flex items-center gap-2 flex-wrap">
            {!isRetracted && !isLatest && (
              <Button variant="outline" className="btn-footer-action" onClick={enterEdit}>
                <Edit2 className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
            {isDraft && !isRetracted && (
              <Button className="btn-footer-action" onClick={() => onSend(message.id)}>
                <Send className="h-4 w-4 mr-1" /> Send
              </Button>
            )}
            {!(isLatest && embedded) && (
              <Button variant="outline" className="btn-footer-action" onClick={() => {
                if (confirm(`Delete this alert "${message.subject}"? This cannot be undone.`)) onDelete(message.id);
              }}>
                <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap bg-muted/40 border border-border/60 rounded-md px-2 py-1">
            {!isRetracted && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" className="toolbar-square-btn toolbar-square-btn-action" onClick={handleSave}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save</TooltipContent>
                </Tooltip>
                {isSent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" className="toolbar-square-btn toolbar-square-btn-action" onClick={handleSaveAndSend}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save &amp; Send</TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
            {(isSent || isDraft) && !isRetracted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="toolbar-square-btn toolbar-square-btn-action"
                    disabled={isDraft}
                    title={isDraft ? 'Retract is only available for Published alerts' : undefined}
                    onClick={() => onRetract(message.id)}
                  >
                    <RotateCcw className="h-4 w-4 text-red-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Retract</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
    )}

    {/* Full-screen edit modal */}
    <Dialog
      open={fullscreen || editing}
      onOpenChange={(o) => { if (!o) attemptClose(); }}
    >
      <DialogContent
        className={`${fullscreen ? 'max-w-[100vw] w-[100vw] h-[100vh] rounded-none [&>button:last-of-type]:hidden' : 'max-w-[96vw] w-[96vw] h-[94vh] sm:rounded-lg'} p-0 gap-0 flex flex-col`}
      >

        {/* Functional icon toolbar */}
        <div className="relative flex items-end justify-between gap-2 pl-5 pr-5 pt-2 pb-0 border-b border-border shrink-0 bg-card/30 overflow-hidden">
          <div className="flex items-end gap-2 overflow-hidden">
            <BackButtonTooltip label={fullscreen ? 'Back to Issue Board' : 'Back to Main Menu'} onClick={handleBack} />

          <Tooltip>

            <TooltipTrigger asChild>
              <span className="relative inline-flex">
                <Button
                  size="icon"
                  variant="outline"
                  aria-pressed={chatOpen}
                  className="toolbar-square-btn"
                  onClick={() => { setChatOpen(o => !o); setChatMinimized(false); }}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                {chatUnread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-destructive text-[10px] text-white font-medium flex items-center justify-center">
                    {chatUnread > 9 ? '9+' : chatUnread}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>{chatUnread > 0 ? `Chat — ${chatUnread} unread` : 'Chat'}</TooltipContent>
          </Tooltip>

          <Popover open={parseOpen} onOpenChange={setParseOpen}>
            <PopoverTrigger asChild>
              <div>
                <ExtractDealFromChatButton
                  size="icon"
                  source="thread"
                  messages={[message]}
                  conversationLabel={message.subject}
                  targetDealIds={message.dealIds}
                  className="toolbar-square-btn-ai"
                  iconOnly
                  tooltip="AI DataParse"
                  armed={parseOpen}
                  runSignal={parseRunSignal}
                  onArmToggle={() => setParseOpen(o => !o)}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3 space-y-3 z-[70]">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Parse deal data from:</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={parseSources.chat} onCheckedChange={() => toggleParseSource('chat')} className="mt-0.5" />
                <span className="text-sm leading-tight">
                  Chat thread
                  <span className="block text-xs text-muted-foreground">Messages in this deal</span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={parseSources.docs} onCheckedChange={() => toggleParseSource('docs')} className="mt-0.5" />
                <span className="text-sm leading-tight">
                  Documents <span className="text-xs text-muted-foreground">(coming soon)</span>
                  <span className="block text-xs text-muted-foreground">{message.attachments.length} attached</span>
                </span>
              </label>
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="toolbar-btn toolbar-btn-action"
                  onClick={() => { setParseRunSignal(n => n + 1); setParseOpen(false); }}
                >
                  <Sparkles className="h-4 w-4 mr-1" style={{ color: '#f3d98a' }} />
                  Run AI Parse
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {editDeal && (
            <span className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-pressed={checkerOpen}
                    className={`btn-champagne toolbar-square-btn-ai ${checkerOpen ? 'ring-2 ring-primary brightness-110' : ''}`}
                    onClick={() => setCheckerOpen(o => !o)}
                  >
                    <ShieldCheck className="h-4 w-4" style={{ color: '#f3d98a' }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">AI Deal Checker</TooltipContent>
              </Tooltip>
              <DealCheckFlag deal={editDeal} className="absolute -top-1 -right-1 border border-white/70" />
            </span>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="toolbar-square-btn"
                aria-label="Digital Term Sheet"
                disabled={!editDeal}
                onClick={() => { if (editDeal) navigate(dtsLink(message, editDeal)); }}
              >
                <span className="text-xs font-semibold">DTS</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Digital Term Sheet</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="relative inline-flex">
                <Button
                  size="icon"
                  variant="outline"
                  aria-pressed={docsOpen}
                  className="toolbar-square-btn"
                  onClick={() => setDocsOpen(o => !o)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
                {message.attachments.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-primary text-[10px] text-primary-foreground font-medium flex items-center justify-center">
                    {message.attachments.length > 9 ? '9+' : message.attachments.length}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>Docs</TooltipContent>
          </Tooltip>

          {canManage && (
          <div className="flex items-end gap-2 bg-muted/40 border border-border/60 rounded-md px-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="toolbar-square-btn toolbar-square-btn-action" onClick={handleSave}>
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="toolbar-square-btn toolbar-square-btn-action" onClick={handleSaveAndSend}>
                  <Send className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save &amp; Send</TooltipContent>
            </Tooltip>
            {(isSent || isDraft) && !isRetracted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" className="toolbar-square-btn toolbar-square-btn-action" onClick={() => onRetract(activeVersion.id)}>
                    <RotateCcw className="h-4 w-4 text-red-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Retract</TooltipContent>
              </Tooltip>
            )}
          </div>
          )}
          </div>
          {editDeal && (
            <div className="absolute left-1/2 bottom-2 -translate-x-1/2 h-10 flex items-center max-w-[50%] pointer-events-none">
              <span className="truncate text-xl md:text-2xl font-bold text-white leading-none tracking-tight">
                {editDeal.issuerName}
              </span>
            </div>
          )}
          <div className="flex items-end gap-2 shrink-0">
            <span className="h-10 flex items-end gap-1.5 text-sm md:text-base font-normal text-white whitespace-nowrap leading-none">
              {formatUTCDateTime(activeVersion.updatedAt)}
              <span className="text-[10px] md:text-xs font-medium text-white/80 uppercase tracking-wide leading-none">UTC</span>
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Close"
              className="h-9 w-9 rounded-md border border-border/70 bg-card/60 hover:bg-accent hover:text-foreground hover:border-border"
              onClick={attemptClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Headline */}
        <div className="flex items-center gap-3 px-5 py-2 border-b border-border shrink-0">
          {viewingArchive ? (
            <div className="flex-1 min-w-0 bg-muted/30 border border-border rounded px-3 py-1.5 text-sm font-bold text-amber-300 truncate">
              {activeVersion.subject}
            </div>
          ) : (
            <input
              value={editSubject}
              onChange={e => setEditSubject(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                  handleSave();
                }
              }}
              placeholder="Subject"
              className="flex-1 min-w-0 bg-background border border-border rounded px-3 py-1.5 text-sm font-bold text-amber-300 placeholder:text-amber-300/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
          <div className="flex items-center gap-1 shrink-0">
            {versionOptions.length > 1 && (
              <Popover open={versionMenuOpen} onOpenChange={setVersionMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-2xl font-bold text-sky-300 tracking-wide drop-shadow-[0_0_6px_rgba(125,211,252,0.45)] hover:bg-sky-400/10"
                  >
                    {activeVersionLabel ?? versionLabel}
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  collisionPadding={12}
                  avoidCollisions
                  className="w-[min(92vw,26rem)] p-1 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto"
                >
                  <div>

                    {versionOptions.map(v => (
                      <button
                        key={v.message.id}
                        type="button"
                        onClick={() => {
                          setViewVersionId(v.message.id === message.id ? null : v.message.id);
                          setVersionMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${v.message.id === activeVersion.id ? 'bg-sky-400/10' : ''}`}
                      >
                        <span className="text-xl font-bold uppercase text-sky-300 whitespace-nowrap">{v.label}</span>
                        <span className="truncate text-sm text-amber-300">{v.message.subject}</span>
                        <span className="ml-auto text-base text-timestamp whitespace-nowrap">
                          {formatUTCDateTime(v.message.updatedAt)} <span className="text-[10px] text-white/70">UTC</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {!viewingArchive && (
                  <>
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    disabled={isSaved}
                    onClick={() => { handleSave(); setIsSaved(true); setVersionMenuOpen(false); }}
                    className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Save className="h-4 w-4" /> {isSaved ? 'Saved' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSaveAndSend(); setIsSaved(false); setVersionMenuOpen(false); }}
                    className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Send className="h-4 w-4" /> Save &amp; Send
                  </button>
                  </>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col px-5 pt-2 pb-1">
            <div className="flex-1 min-h-0 overflow-hidden border border-dashed border-primary/40 rounded-md">
              {viewingArchive ? (
                <div className="h-full overflow-auto px-3 py-3 text-sm">
                  {isHtml(activeVersion.body) ? (
                    <div className="alert-message-body prose-alert" dangerouslySetInnerHTML={{ __html: sanitizeHtml(activeVersion.body) }} />
                  ) : (
                    <LinkifiedText text={activeVersion.body} />
                  )}
                </div>
              ) : (
              <RichTextEditor
                value={editBody}
                onChange={setEditBody}
                placeholder="Write the alert body…"
                className="h-full border-0 rounded-none"
                contentClassName="alert-message-body px-3 py-3"
              />
              )}
            </div>
          </div>

          {/* Floating associated chat — draggable, resizable, minimisable */}
          {chatOpen && (
            <DraggablePanel
              title="Associated Chat Thread"
              collapsed={chatMinimized}
              className="chat-panel-border"
              initialWidth={400}
              initialHeight={480}
              headerActions={
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    title={chatMinimized ? 'Expand chat' : 'Minimise chat'}
                    onClick={() => setChatMinimized(m => !m)}
                  >
                    {chatMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" title="Close chat" onClick={() => setChatOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              }
            >
              <div className="flex-1 min-h-0 p-2">
                <SecureChat
                  key={message.dealIds?.[0] ?? 'no-deal'}
                  activeDealId={message.dealIds?.[0] ?? null}
                  heightClass="h-full"
                  allowDealAccess
                  hideStageBadge
                  fallbackThreadLabel={message.subject}
                />
              </div>
            </DraggablePanel>
          )}

          {/* Floating AI Deal Checker */}
          {checkerOpen && editDeal && (
            <DraggablePanel
              title="AI Deal Checker"
              initialWidth={440}
              initialHeight={520}
              className="border border-border"
              headerCenter={<DealCheckerLogo size={28} />}
              headerActions={
                <Button size="icon" variant="ghost" className="h-6 w-6" title="Close" onClick={() => setCheckerOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              }
            >
              <div className="flex-1 min-h-0 overflow-auto p-2">
                <DealChecker
                  deal={editDeal}
                  alertText={`${editSubject}\n${editBody}`}
                  userRole={currentUser?.role}
                  currentUserId={currentUser?.id}
                  currentUserName={currentUser?.name}
                />
              </div>
            </DraggablePanel>
          )}
        </div>


        {/* Attachments panel */}
        {docsOpen && (
        <div
          className="px-5 py-2 border-t border-border shrink-0 relative"
          onMouseEnter={() => setAttachmentsHover(true)}
          onMouseLeave={() => setAttachmentsHover(false)}
          {...dropZoneProps}
        >

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
              Attachments ({message.attachments.length})
            </span>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Add files</TooltipContent>
                </Tooltip>
                {(attachmentsHover || dragOver) && (
                  <div
                    onClick={() => fileInputRef.current?.click()}

                    className={`flex-1 border border-dashed rounded px-2 py-1 text-center text-xs text-muted-foreground transition-colors cursor-pointer hover:border-primary hover:bg-primary/5 ${dragOver ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    Drop PDF, DOCX, or PPTX here
                  </div>
                )}
              </>
            )}
          </div>
          {message.attachments.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {message.attachments.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-xs bg-background border border-border rounded px-2 py-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPreviewAttachment(a)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Preview</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadAttachment(a)}>
                        <Download className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Download</TooltipContent>
                  </Tooltip>
                  {!isRetracted && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeAttachment(a.id)}>
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Remove</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Save / Send / Retract actions now live in the top toolbar */}
      </DialogContent>
    </Dialog>
    </>
  );
}
