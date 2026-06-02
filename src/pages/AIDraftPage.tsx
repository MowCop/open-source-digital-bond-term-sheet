import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Attachment } from '@/types/bond';
import { Checkbox } from '@/components/ui/checkbox';
import { Bookrunner } from '@/types/bond';
import { extractBookrunners, simulateAIExtraction } from '@/lib/alertParsing';
import DealChecker from '@/components/DealChecker';
import { Sparkles, Paperclip, Send, Save, ChevronDown, MessageSquare, X, Download, Replace, Trash2 } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import { stripHtml } from '@/lib/htmlText';
import { docxFileToHtml } from '@/lib/docxToHtml';
import { pdfFileToHtml } from '@/lib/pdfToHtml';
import type { Editor } from '@tiptap/react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Trigger mode for AI extraction in the bulletin builder. Persisted in
// localStorage from Bond Console > AI Bulletin Extraction.
// - 'live'   = also call AI as the user types (debounced)
// - 'onSave' = run AI on every document drop + on explicit Save/Send  (default)
// - 'manual' = only run AI when the user clicks "Run AI extraction"
export type AITriggerMode = 'live' | 'onSave' | 'manual';
export const AI_TRIGGER_MODE_KEY = 'bondvdr.ai.triggerMode';
export function getAITriggerMode(): AITriggerMode {
  if (typeof window === 'undefined') return 'onSave';
  const v = window.localStorage.getItem(AI_TRIGGER_MODE_KEY);
  return v === 'live' || v === 'manual' ? v : 'onSave';
}

/**
 * Append-by-default merge: keeps any pre-existing non-empty value, fills
 * blanks from the new extraction, and treats differing non-empty values as
 * conflicts to be surfaced in the UI rather than silently overwritten.
 * Returns the merged record AND a list of conflict keys with the proposed
 * new value, via an out-callback on the React state setter.
 */
function mergeFieldsWithConflicts(
  prev: Record<string, string> | null,
  incoming: Record<string, string>,
): Record<string, string> {
  const base = prev ? { ...prev } : {};
  for (const [k, raw] of Object.entries(incoming)) {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) continue;
    const cur = (base[k] ?? '').trim();
    if (!cur) base[k] = v; // fill blank
    // If cur exists and differs from v, leave cur alone — conflict is
    // tracked separately in setAiConflicts (see callers).
    else if (cur !== v) base[k] = cur;
  }
  return base;
}

/** Diff helper for the conflict tracker. */
function diffConflicts(
  prev: Record<string, string> | null,
  incoming: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!prev) return out;
  for (const [k, raw] of Object.entries(incoming)) {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) continue;
    const cur = (prev[k] ?? '').trim();
    if (cur && cur !== v) out[k] = v;
  }
  return out;
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function AIDraftPage() {
  const { distributionLists, createMessage, createDeal, currentUser, users, addAuditEntry } = useApp();
  const { toast } = useToast();

  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [aiFields, setAiFields] = useState<Record<string, string> | null>(null);
  const [aiBookrunners, setAiBookrunners] = useState<Bookrunner[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number>(0);
  // Per-field conflicts surfaced when a fresh extraction returns a value that
  // differs from a non-empty value the user already had. Append-by-default:
  // we keep the existing value and let the user explicitly Replace.
  const [aiConflicts, setAiConflicts] = useState<Record<string, string>>({});
  const [triggerMode, setTriggerMode] = useState<AITriggerMode>(() => getAITriggerMode());
  // Re-read trigger mode when window regains focus, so changing it in
  // Bond Console takes effect without a reload.
  useEffect(() => {
    const refresh = () => setTriggerMode(getAITriggerMode());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const [sendTarget, setSendTarget] = useState<'all' | 'selected'>('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtractingAttachment, setIsExtractingAttachment] = useState(false);
  // Syndicate Chat Participants (SCPs) selected for the new deal's chat channel.
  const [scpIds, setScpIds] = useState<string[]>([]);
  const [scpQuery, setScpQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  // Vendor/distribution recipients
  const vendorUsers = users.filter(u => u.organizationType === 'vendor');
  // Syndicate-eligible users (any category === 'Syndicate'). AI-style predictive filter.
  const syndicateCandidates = users.filter(u => u.category === 'Syndicate' && u.id !== currentUser.id);
  const q = scpQuery.trim().toLowerCase();
  const scpMatches = q
    ? syndicateCandidates.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.organization || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      ).slice(0, 6)
    : [];
  const toggleScp = (id: string) => {
    setScpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Auto-extract AI fields when headline or body changes
  useEffect(() => {
    const combined = `${headline} ${stripHtml(body)}`.trim();
    if (combined.length < 10) {
      setAiFields(null);
      setAiBookrunners([]);
      return;
    }
    const timer = setTimeout(() => {
      const result = simulateAIExtraction(combined);
      const nonEmpty = Object.entries(result.keyTerms).filter(([, v]) => v);
      const bookrunners = extractBookrunners(combined);
      if (nonEmpty.length > 0 || bookrunners.length > 0) {
        setAiFields(result.keyTerms);
        setAiConfidence(result.confidence);
        setAiBookrunners(bookrunners);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [headline, body]);

  // ── File validation ────────────────────────────────────────────────────────
  const ALLOWED_EXT = ['pdf', 'docx', 'pptx'] as const;
  const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword', // legacy .doc shows up as .docx sometimes
    '', // some browsers don't set a mime — fall back to extension check
  ]);
  const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

  /** Returns null if valid, otherwise a human-readable reason. */
  const validateAttachment = (file: File): string | null => {
    if (file.size === 0) return 'File is empty';
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return `File is ${mb} MB — maximum is 20 MB`;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext as any)) {
      return `Unsupported file type ".${ext}" — allowed: PDF, DOCX, PPTX`;
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return `Unexpected MIME type "${file.type}" for .${ext}`;
    }
    return null;
  };

  const toAttachment = (file: File): Attachment => ({
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    type: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.docx') ? 'docx' : 'pptx',
    size: file.size,
    url: '',
    file,
    mimeType: file.type || undefined,
  });

  const applyExtractedText = async (text: string, fileName: string, opts?: { skipAI?: boolean }) => {
    const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!clean) return;

    // 1) Fast regex baseline so the Deal Checker shows something immediately.
    const baseline = simulateAIExtraction(clean);
    const baselineBookrunners = extractBookrunners(clean);
    const subjectLine = baseline.headline && !baseline.headline.startsWith('Issuer ')
      ? baseline.headline
      : fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

    setHeadline(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return subjectLine;
      if (/(New Issue Alert|Priced|Settled|Books (Open|Closed)|Launched|Announced|Mandate)\s*$/i.test(trimmed)) return subjectLine;
      return trimmed;
    });
    // Merge baseline into existing fields with conflict tracking
    setAiFields(prev => mergeFieldsWithConflicts(prev, baseline.keyTerms));
    setAiConfidence(baseline.confidence);
    setAiBookrunners(baselineBookrunners);

    if (opts?.skipAI) return;

    // 2) Call Lovable AI for a richer, more accurate extraction; merge over the baseline.
    try {
      const { data, error } = await supabase.functions.invoke('extract-deal-fields-ai', {
        body: { text: clean },
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'keyTerms' in data) {
        const aiKeyTerms = (data as any).keyTerms as Record<string, string>;
        const aiBks = (data as any).bookrunners as Bookrunner[] | undefined;

        // Append-by-default: keep current value, surface differences as
        // per-field conflicts the user can explicitly replace.
        setAiFields(prev => mergeFieldsWithConflicts(prev ?? baseline.keyTerms, aiKeyTerms || {}));
        if (Array.isArray(aiBks) && aiBks.length > 0) setAiBookrunners(aiBks);

        // If AI gave us a stronger issuer, refresh the auto-headline.
        const aiIssuer = (aiKeyTerms?.['Issuer Name'] || '').trim();
        if (aiIssuer) {
          setHeadline(prev => {
            const trimmed = prev.trim();
            if (!trimmed) return `${aiIssuer} — New Issue Alert`;
            if (/(New Issue Alert|Priced|Settled|Books (Open|Closed)|Launched|Announced|Mandate)\s*$/i.test(trimmed)
                && !trimmed.toLowerCase().includes(aiIssuer.toLowerCase())) {
              return `${aiIssuer} — New Issue Alert`;
            }
            return trimmed;
          });
        }
        toast({ title: 'AI extraction complete', description: 'Deal terms parsed from attachment.' });
      }
    } catch (err: any) {
      const status = err?.context?.status;
      if (status === 429) {
        toast({ title: 'AI rate limit', description: 'Too many requests — try again shortly.', variant: 'destructive' });
      } else if (status === 402) {
        toast({ title: 'AI credits exhausted', description: 'Add credits in workspace settings.', variant: 'destructive' });
      } else {
        console.error('AI extraction failed; using regex baseline', err);
      }
    }
  };

  const appendHtmlToBody = (html: string) => {
    if (!html) return;
    const editor = editorRef.current;
    if (editor) {
      editor.chain().focus('end').insertContent(html).run();
    } else {
      setBody(prev => (prev ? `${prev}<hr/>${html}` : html));
    }
  };

  type ExtractOutcome = {
    ok: boolean;
    reason?: 'empty' | 'unsupported' | 'parse_error';
    message?: string;
  };

  const extractFromFile = async (file: File): Promise<ExtractOutcome> => {
    const name = file.name.toLowerCase();
    const isDocx = name.endsWith('.docx');
    const isPdf  = name.endsWith('.pdf');
    if (!isDocx && !isPdf) {
      return { ok: false, reason: 'unsupported', message: 'Only PDF and DOCX can be auto-read.' };
    }
    try {
      const { html, text } = isDocx
        ? await docxFileToHtml(file)
        : await pdfFileToHtml(file);

      if (!html || !text || text.trim().length < 20) {
        return {
          ok: false,
          reason: 'empty',
          message: isPdf
            ? 'No readable text found — the PDF may be image-only or password-protected.'
            : 'No readable text found in the document.',
        };
      }
      appendHtmlToBody(html);
      void applyExtractedText(text, file.name);
      return { ok: true };
    } catch (err) {
      console.error('extraction failed', file.name, err);
      const msg = err instanceof Error ? err.message : 'Parser error';
      return { ok: false, reason: 'parse_error', message: msg };
    }
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // 1) Validate up-front — accept the good, reject the bad with a clear toast.
    const accepted: File[] = [];
    for (const f of files) {
      const err = validateAttachment(f);
      if (err) {
        toast({ title: `Rejected "${f.name}"`, description: err, variant: 'destructive' });
      } else {
        accepted.push(f);
      }
    }
    if (accepted.length === 0) return;

    setAttachments(prev => [...prev, ...accepted.map(toAttachment)]);

    const extractable = accepted.filter(f => /\.(pdf|docx)$/i.test(f.name));
    if (extractable.length === 0) {
      toast({ title: 'Files attached', description: `${accepted.length} file(s) added` });
      return;
    }

    setIsExtractingAttachment(true);
    const hasPdf = extractable.some(f => /\.pdf$/i.test(f.name));
    if (hasPdf) {
      toast({ title: 'Reading document…', description: 'Scanned PDFs are processed with AI OCR and may take 30–60s.' });
    }
    let extractedCount = 0;
    const failures: Array<{ name: string; message: string }> = [];
    try {
      for (const file of extractable) {
        const outcome = await extractFromFile(file);
        if (outcome.ok) extractedCount++;
        else failures.push({ name: file.name, message: outcome.message || 'Unknown error' });
      }
      if (extractedCount > 0) {
        toast({ title: 'Document read', description: `Parsed text from ${extractedCount} attachment(s). AI extracting deal terms…` });
      }
      for (const f of failures) {
        toast({ title: `Couldn't read "${f.name}"`, description: f.message, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Attachment extraction failed', error);
      toast({ title: 'Extraction failed', description: 'The attachment could not be read.', variant: 'destructive' });
    } finally {
      setIsExtractingAttachment(false);
    }
  };

  const downloadAttachment = (a: Attachment) => {
    if (!a.file) {
      toast({ title: 'File unavailable', description: 'Re-attach to enable download.', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(a.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const requestReplace = (id: string) => {
    replaceTargetIdRef.current = id;
    replaceInputRef.current?.click();
  };

  const handleReplaceSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetId = replaceTargetIdRef.current;
    replaceTargetIdRef.current = null;
    if (!file || !targetId) return;
    const validationError = validateAttachment(file);
    if (validationError) {
      toast({ title: `Rejected "${file.name}"`, description: validationError, variant: 'destructive' });
      return;
    }
    const oldName = attachments.find(a => a.id === targetId)?.name;
    const replacement: Attachment = { ...toAttachment(file), id: targetId };
    setAttachments(prev => prev.map(a => (a.id === targetId ? replacement : a)));
    if (/\.(pdf|docx)$/i.test(file.name)) {
      setIsExtractingAttachment(true);
      const outcome = await extractFromFile(file);
      setIsExtractingAttachment(false);
      if (!outcome.ok) {
        toast({ title: `Couldn't read "${file.name}"`, description: outcome.message || 'Unknown error', variant: 'destructive' });
      }
    }
    toast({ title: 'Attachment replaced', description: oldName ? `Replaced ${oldName} with ${file.name}` : `Replaced with ${file.name}` });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    void handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    void handleFiles(files);
    e.target.value = '';
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedRecipients(vendorUsers.map(u => u.id));
  };

  const deselectAll = () => {
    setSelectedRecipients([]);
  };

  const createDealFromFields = () => {
    return createDeal({
      issuerName: aiFields?.['Issuer Name'] || headline.split(/\s+/).slice(0, 3).join(' ') || 'New Deal',
      currency: aiFields?.['Currency'] || '',
      size: aiFields?.['Size'] || '',
      tenor: aiFields?.['Tenor'] || '',
      coupon: aiFields?.['Coupon'] || '',
      stage: 'Mandate',
      bookrunners: aiBookrunners ?? [],
      issuerRating: aiFields?.['Issuer Rating'] || undefined,
      issuerLEI: aiFields?.['LEI'] || undefined,
      isin: aiFields?.['ISIN'] || undefined,
      reofferSpread: aiFields?.['Reoffer Spread'] || undefined,
      issuePrice: aiFields?.['Issue Price'] || undefined,
      reofferPrice: aiFields?.['Reoffer Price'] || undefined,
      reofferYield: aiFields?.['Reoffer Yield'] || undefined,
      midSwapRate: aiFields?.['Mid-Swap Rate'] || undefined,
      pricingDate: aiFields?.['Pricing Date'] || undefined,
      settlementDate: aiFields?.['Settlement Date'] || undefined,
      maturityDate: aiFields?.['Maturity Date'] || undefined,
      specifiedDenomination: aiFields?.['Denomination'] || undefined,
      governingLaw: aiFields?.['Governing Law'] ? aiFields['Governing Law'].toUpperCase().replace(/ /g, '_') as any : undefined,
      listingVenue: aiFields?.['Listing'] || undefined,
    }, scpIds);
  };

  const uploadPendingAttachments = async (): Promise<Attachment[]> => {
    const out: Attachment[] = [];
    for (const a of attachments) {
      if (a.url || !a.file) {
        out.push(a);
        continue;
      }
      try {
        const safe = a.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
        const path = `${currentUser.id}/${a.id}-${safe}`;
        const { error } = await supabase.storage
          .from('message-attachments')
          .upload(path, a.file, { contentType: a.mimeType || a.file.type || undefined, upsert: true });
        if (error) throw error;
        const { data: signed, error: signErr } = await supabase.storage
          .from('message-attachments')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signErr) throw signErr;
        out.push({ ...a, url: signed.signedUrl });
      } catch (err) {
        console.error('attachment upload failed', a.name, err);
        toast({ title: 'Upload failed', description: `Could not upload ${a.name}`, variant: 'destructive' });
        out.push(a);
      }
    }
    return out;
  };

  const handleSave = async () => {
    if (!headline.trim()) {
      toast({ title: 'Missing headline', description: 'Please enter a deal headline', variant: 'destructive' });
      return;
    }
    const deal = createDealFromFields();
    const uploaded = await uploadPendingAttachments();
    createMessage({
      dealIds: [deal.id],
      subject: headline,
      body,
      status: 'draft',
      senderId: currentUser.id,
      recipients: selectedRecipients,
      attachments: uploaded,
      aiSuggestions: aiFields ? { headline, borrowerDetails: '', dealSummary: '', keyTerms: aiFields, confidence: aiConfidence } : undefined,
    });
    toast({ title: 'Draft Saved', description: 'Issue saved as draft in New Issue Board.' });
  };

  const handleSend = async () => {
    if (!headline.trim()) {
      toast({ title: 'Missing headline', description: 'Please enter a deal headline', variant: 'destructive' });
      return;
    }
    if (selectedRecipients.length === 0) {
      toast({ title: 'No recipients', description: 'Select at least one distribution recipient', variant: 'destructive' });
      return;
    }
    const deal = createDealFromFields();
    const uploaded = await uploadPendingAttachments();
    createMessage({
      dealIds: [deal.id],
      subject: headline,
      body,
      status: 'sent',
      senderId: currentUser.id,
      recipients: selectedRecipients,
      attachments: uploaded,
      aiSuggestions: aiFields ? { headline, borrowerDetails: '', dealSummary: '', keyTerms: aiFields, confidence: aiConfidence } : undefined,
    });
    toast({ title: 'Alert Sent', description: `Sent to ${selectedRecipients.length} recipient(s)` });
    setHeadline(''); setBody(''); setAttachments([]); setSelectedRecipients([]); setAiFields(null); setAiBookrunners([]); setScpIds([]); setScpQuery('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Create New Issue</h1>
        <p className="text-muted-foreground text-sm">Draft a new message to automatically generate deal records.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: Main compose area */}
        <div className="col-span-2 flex flex-col">
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={e => {
              // Only clear when leaving the card itself, not child elements
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
            className={`relative bg-card border rounded-lg flex-1 flex flex-col transition-colors ${isDragOver ? 'border-accent border-dashed bg-accent/5' : 'border-border'}`}
          >
            {/* Headline */}
            <Input
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              placeholder="Enter deal headline (e.g. Republic of Italy EUR 1.5bn 10Y BTP Syndication)"
              className="border-0 border-b border-border rounded-none text-base px-4 py-4 h-auto bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
            <div className="flex flex-1 flex-col min-h-[400px]">
              {/* Rich-text body editor — preserves formatting from dropped Word / PDF files */}
              <div className="flex flex-1 flex-col min-h-0">
                <RichTextEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Start typing or drag and drop files to extract, parse and check..."
                  className="flex-1 min-h-0 border-0 rounded-none bg-transparent"
                  onReady={editor => { editorRef.current = editor; }}
                />
              </div>
              {/* Slim attachment strip */}
              <div className="max-h-28 overflow-y-auto px-4 py-2 border-t border-border text-xs text-muted-foreground/60">
                {attachments.length > 0 ? (
                  <div className="w-full space-y-1">
                    {isExtractingAttachment && (
                      <div className="flex items-center gap-2 text-xs text-accent">
                        <Sparkles className="h-3 w-3 animate-pulse" />
                        Extracting headline, body, and deal fields from attachment…
                      </div>
                    )}
                    {attachments.map((f, i) => {
                      const sizeKb = f.size ? `${(f.size / 1024).toFixed(0)} KB` : '';
                      const hasFile = !!f.file;
                      return (
                        <div key={f.id} className="flex items-center gap-2 text-xs text-foreground">
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{f.name}</span>
                          {sizeKb && <span className="text-muted-foreground text-[10px] shrink-0">· {sizeKb}</span>}
                          <div className="ml-auto flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => downloadAttachment(f)}
                              disabled={!hasFile}
                              title={hasFile ? 'Download original file' : 'Original file no longer available — re-attach to download'}
                              className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestReplace(f.id)}
                              title="Replace with a new file"
                              className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground"
                            >
                              <Replace className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                              title="Remove attachment"
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-3 w-3" />
                    <span>Drag PDF, Word, or PPT files anywhere on this pane — or click Attach.</span>
                  </div>
                )}
              </div>
            </div>
            {isDragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-accent/10">
                <div className="rounded-md border border-dashed border-accent bg-background/80 px-4 py-2 text-sm font-medium text-accent">
                  Drop files to attach
                </div>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 mt-3 px-1">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <input ref={replaceInputRef} type="file" className="hidden" onChange={handleReplaceSelect} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-1" /> Attach
            </Button>
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Send to <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {distributionLists.map(dl => (
                  <DropdownMenuItem key={dl.id} onClick={() => setSelectedRecipients(dl.memberIds || [])}>
                    {dl.name} ({(dl.memberIds || []).length})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
            <Button size="sm" onClick={handleSend} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Send className="h-4 w-4 mr-1" /> Send
            </Button>
          </div>
        </div>

        {/* Right: AI extraction + Distribution */}
        <div className="space-y-4">
          {/* AI Field Extraction */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="font-semibold text-sm">AI Field Extraction</span>
              {aiFields && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {(aiConfidence * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
            <div className="p-4">
              {aiFields ? (
                <div className="space-y-2">
                  {Object.entries(aiFields).map(([key, value]) => (
                    value ? (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-24 shrink-0">{key}</span>
                        <span className="text-foreground font-medium">{value}</span>
                      </div>
                    ) : null
                  ))}
                  {aiBookrunners.length > 0 && (
                    <div className="flex items-start gap-2 text-xs pt-2 border-t border-border">
                      <span className="text-muted-foreground w-24 shrink-0 mt-1">Bookrunners</span>
                      <div className="flex flex-wrap gap-1">
                        {aiBookrunners.map(b => (
                          <Badge key={b.name} variant="secondary" className="text-[10px]">
                            {b.name}{b.isGlobalCoordinator ? ' (GC)' : ''}{b.role === 'passive' ? ' (P)' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.values(aiFields).every(v => !v) && aiBookrunners.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No fields detected yet.</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Sparkles className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-xs text-center">Start typing a headline or message body to auto-extract deal fields.</p>
                </div>
              )}
            </div>
          </div>

          <DealChecker
            aiFields={aiFields}
            aiBookrunners={aiBookrunners}
            userRole={currentUser?.role}
            currentUserId={currentUser?.id}
            currentUserName={currentUser?.name}
            onAuditEntries={(entries) =>
              entries.forEach((e) =>
                addAuditEntry({
                  action: 'deal_checker_override',
                  entityType: 'deal_checker_override',
                  entityId: 'draft',
                  userId: e.adminUserId,
                  details: JSON.stringify(e),
                })
              )
            }
          />

          {/* Distribution */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm uppercase tracking-wider">Distribution</span>
              <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded border border-border bg-background hover:bg-accent/10 transition-colors">
                <Checkbox
                  checked={vendorUsers.length > 0 && selectedRecipients.length === vendorUsers.length}
                  onCheckedChange={(checked) => (checked ? selectAll() : deselectAll())}
                />
                <span className="text-xs font-medium">
                  {selectedRecipients.length === vendorUsers.length ? 'Deselect All' : 'Select All'}
                </span>
              </label>
            </div>
            <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border">
              Grants screen + deal data access only. Chat is managed separately below.
            </div>
            <div className="divide-y divide-border">
              {vendorUsers.map(v => (
                <label key={v.id} className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-card/60 transition-colors">
                  <span className="text-sm">{v.organization}</span>
                  <Checkbox
                    checked={selectedRecipients.includes(v.id)}
                    onCheckedChange={() => toggleRecipient(v.id)}
                  />
                </label>
              ))}
              {distributionLists.map(dl => (
                <label key={dl.id} className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-card/60 transition-colors">
                  <span className="text-sm">{dl.name} <span className="text-muted-foreground text-xs">({(dl.memberIds || []).length})</span></span>
                  <Checkbox
                    checked={(dl.memberIds || []).every(id => selectedRecipients.includes(id))}
                    onCheckedChange={checked => {
                      if (checked) {
                        setSelectedRecipients(prev => [...new Set([...prev, ...(dl.memberIds || [])])]);
                      } else {
                        setSelectedRecipients(prev => prev.filter(id => !(dl.memberIds || []).includes(id)));
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Syndicate Chat Participants (SCPs) */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <MessageSquare className="h-4 w-4 text-accent" />
              <span className="font-semibold text-sm uppercase tracking-wider">Syndicate Chat Participants</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{scpIds.length}</Badge>
            </div>
            <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border">
              Auto-added to this New Issue's chat. Only Syndicate users are eligible.
            </div>
            <div className="p-3 space-y-2">
              {scpIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scpIds.map(id => {
                    const u = users.find(x => x.id === id);
                    if (!u) return null;
                    return (
                      <Badge key={id} variant="secondary" className="text-[11px] gap-1 pr-1">
                        {u.name} <span className="text-muted-foreground">· {u.organization}</span>
                        <button onClick={() => toggleScp(id)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <Input
                  value={scpQuery}
                  onChange={e => setScpQuery(e.target.value)}
                  placeholder="Type a name, bank, or email…"
                  className="h-8 text-xs"
                />
                {q && scpMatches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-60 overflow-y-auto">
                    {scpMatches.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { toggleScp(u.id); setScpQuery(''); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent/20 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-muted-foreground">{u.organization} · {u.email}</div>
                        </div>
                        {scpIds.includes(u.id) && <Badge variant="secondary" className="text-[10px]">added</Badge>}
                      </button>
                    ))}
                  </div>
                )}
                {q && scpMatches.length === 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-md shadow-md px-3 py-2 text-xs text-muted-foreground">
                    No matching Syndicate user.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
