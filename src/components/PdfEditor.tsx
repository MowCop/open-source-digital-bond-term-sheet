import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Attachment } from '@/types/bond';
import { ADOBE_EMBED_CLIENT_ID, isAdobeEmbedConfigured } from '@/lib/adobeConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';

declare global {
  interface Window {
    AdobeDC?: {
      View: new (config: { clientId: string; divId: string }) => AdobeView;
    };
  }
}

interface AdobeView {
  previewFile: (
    content: {
      content: { promise: Promise<ArrayBuffer> } | { location: { url: string } };
      metaData: { fileName: string; id?: string };
    },
    options?: Record<string, unknown>,
  ) => Promise<AdobePreview>;
  registerCallback: (type: string, callback: (event: unknown) => void, options?: Record<string, unknown>) => void;
}

interface AdobePreview {
  getAnnotationManager: () => Promise<AdobeAnnotationManager>;
}

interface AdobeAnnotationManager {
  getAnnotations: () => Promise<unknown[]>;
  addAnnotations: (annotations: unknown[]) => Promise<void>;
  registerEventListener: (cb: (event: { type: string; data: unknown }) => void, options?: Record<string, unknown>) => void;
  exportAnnotations: () => Promise<unknown[]>;
}

interface PdfEditorProps {
  attachment: Attachment;
  canEdit?: boolean;
}

/** Convert a data:application/pdf;base64,... URL to an ArrayBuffer. */
async function dataUrlToArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return await res.arrayBuffer();
}

/** Wait until window.AdobeDC is ready. */
function waitForAdobeDC(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AdobeDC) return resolve();
    const start = Date.now();
    const onReady = () => resolve();
    document.addEventListener('adobe_dc_view_sdk.ready', onReady, { once: true });
    const poll = setInterval(() => {
      if (window.AdobeDC) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(poll);
        document.removeEventListener('adobe_dc_view_sdk.ready', onReady);
        reject(new Error('Adobe PDF Embed SDK failed to load within timeout'));
      }
    }, 100);
  });
}

export default function PdfEditor({ attachment, canEdit = true }: PdfEditorProps) {
  const { currentUser, addAuditEntry } = useApp();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const annotationManagerRef = useRef<AdobeAnnotationManager | null>(null);
  const divId = useRef(`adobe-pdf-${attachment.id}-${Math.random().toString(36).slice(2, 8)}`);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Init Adobe viewer
  useEffect(() => {
    let cancelled = false;

    if (!isAdobeEmbedConfigured()) {
      setStatus('error');
      setErrorMsg(
        'Adobe PDF Embed client ID is not configured. Register a free key at acrobatservices.adobe.com and set VITE_ADOBE_EMBED_CLIENT_ID.',
      );
      return;
    }

    (async () => {
      try {
        await waitForAdobeDC();
        if (cancelled) return;

        const view = new window.AdobeDC!.View({
          clientId: ADOBE_EMBED_CLIENT_ID,
          divId: divId.current,
        });

        // Build a content promise that works for both data URLs and http(s) URLs.
        const contentPromise = attachment.url.startsWith('data:')
          ? dataUrlToArrayBuffer(attachment.url)
          : fetch(attachment.url).then((r) => r.arrayBuffer());

        const preview = await view.previewFile(
          {
            content: { promise: contentPromise },
            metaData: { fileName: attachment.name, id: attachment.id },
          },
          {
            embedMode: 'SIZED_CONTAINER',
            showAnnotationTools: canEdit,
            enableAnnotationAPIs: true,
            includePDFAnnotations: true,
            showDownloadPDF: true,
            showPrintPDF: true,
            showLeftHandPanel: true,
            defaultViewMode: 'FIT_PAGE',
          },
        );

        const manager = await preview.getAnnotationManager();
        annotationManagerRef.current = manager;

        // Load saved annotations from Supabase (if any).
        try {
          const { data, error } = await supabase
            .from('pdf_annotations')
            .select('xfdf')
            .eq('attachment_id', attachment.id);
          if (!error && data && data.length > 0) {
            const merged: unknown[] = [];
            for (const row of data) {
              try {
                const parsed = JSON.parse(row.xfdf as string);
                if (Array.isArray(parsed)) merged.push(...parsed);
              } catch {
                /* ignore malformed */
              }
            }
            if (merged.length > 0) {
              await manager.addAnnotations(merged);
            }
          }
        } catch (err) {
          console.warn('Failed to load saved annotations', err);
        }

        // Track changes
        if (canEdit) {
          manager.registerEventListener(
            (event) => {
              if (
                event.type === 'ANNOTATION_ADDED' ||
                event.type === 'ANNOTATION_UPDATED' ||
                event.type === 'ANNOTATION_DELETED'
              ) {
                setDirty(true);
              }
            },
            { listenOn: ['ANNOTATION_ADDED', 'ANNOTATION_UPDATED', 'ANNOTATION_DELETED'] },
          );
        }

        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load PDF';
        console.error('PdfEditor init failed', err);
        setErrorMsg(msg);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id, attachment.url, canEdit]);

  const handleSave = useCallback(async () => {
    if (!annotationManagerRef.current) return;
    setSaving(true);
    try {
      const annotations = await annotationManagerRef.current.exportAnnotations();
      const payload = JSON.stringify(annotations);

      const { data: sessionData } = await supabase.auth.getUser();
      const uid = sessionData.user?.id;
      if (!uid) {
        toast({
          title: 'Sign-in required',
          description: 'You must be signed in to save annotations.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('pdf_annotations')
        .upsert(
          {
            attachment_id: attachment.id,
            user_id: uid,
            xfdf: payload,
          },
          { onConflict: 'attachment_id,user_id' },
        );

      if (error) throw error;

      addAuditEntry({
        action: 'PDF_ANNOTATED',
        entityType: 'message',
        entityId: attachment.id,
        userId: currentUser.id,
        details: `Saved annotations on "${attachment.name}" (${Array.isArray(annotations) ? annotations.length : 0} marks)`,
      });

      setDirty(false);
      toast({ title: 'Annotations saved' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [attachment.id, attachment.name, addAuditEntry, currentUser.id, toast]);

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {canEdit && status === 'ready' && (
        <div className="flex items-center justify-end gap-2 px-2 py-2 border-b border-border bg-card/40 shrink-0">
          <span className="text-xs text-muted-foreground mr-auto">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save annotations
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div className="font-medium">Unable to load PDF editor</div>
          <div className="text-muted-foreground max-w-md">{errorMsg}</div>
          <Button variant="outline" size="sm" asChild>
            <a href={attachment.url} download={attachment.name}>
              <Download className="h-3 w-3 mr-1" /> Download original PDF
            </a>
          </Button>
        </div>
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div
        ref={containerRef}
        id={divId.current}
        className="flex-1 min-h-0 w-full bg-background"
        style={{ height: '100%' }}
      />
    </div>
  );
}