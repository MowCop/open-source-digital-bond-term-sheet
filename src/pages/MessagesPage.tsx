import { useState, useRef, useEffect, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp, useScopedApp } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Message, DealStage, MessageStatus } from '@/types/bond';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, Plus, MessageSquare, Database, History, Edit2, BookOpen, FileText, Paperclip, Shield } from 'lucide-react';
import FloatingChatPanel from '@/components/FloatingChatPanel';
import ChatModalDialog from '@/components/ChatModalDialog';
import AlertHistoryCard from '@/components/AlertHistoryCard';
import ExtractDealFromChatButton from '@/components/ExtractDealFromChatButton';
import DealChecker from '@/components/DealChecker';
import DealCheckFlag from '@/components/DealCheckFlag';
import { useDealChecker } from '@/hooks/useDealChecker';
import { useToast } from '@/hooks/use-toast';
import { mergeDealFromText, isStageForward, simulateAIExtraction, detectStage } from '@/lib/alertParsing';
import { stripHtml } from '@/lib/htmlText';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const stageBadge: Record<DealStage, { label: string; className: string }> = {
  Mandate: { label: 'Mandate', className: 'bg-blue-900/50 text-green-400' },
  Announced: { label: 'Announced', className: 'bg-blue-900/50 text-green-400' },
  Launched: { label: 'Launched', className: 'bg-blue-900/50 text-green-400' },
  'Books Open': { label: 'Books Open', className: 'bg-blue-900/50 text-green-400' },
  'Books Closed': { label: 'Books Closed', className: 'bg-blue-900/50 text-green-400' },
  Priced: { label: 'Priced', className: 'bg-card text-timestamp' },
  Settled: { label: 'Settled', className: 'bg-card text-timestamp' },
};

// "Send" = "Publish" in product terms. We collapse the underlying message
// statuses into a 3-state publish lifecycle so the New Issue Board can
// clearly distinguish Pre-Published (saved-but-not-sent) from Published
// (sent) from Retracted.
export type PublishStatus = 'pre_published' | 'published' | 'retracted';

export function publishStatusOf(m: Message): PublishStatus {
  if (m.status === 'retracted') return 'retracted';
  if (m.status === 'sent') return 'published';
  return 'pre_published';
}

const publishStatusBadge: Record<PublishStatus, { label: string; className: string; dot: string }> = {
  pre_published: {
    label: 'Pre-Published',
    className: 'bg-amber-900/40 text-amber-300 border-amber-800',
    dot: 'bg-amber-400',
  },
  published: {
    label: 'Published',
    className: 'bg-card text-timestamp border-timestamp',
    dot: 'bg-green-400',
  },
  retracted: {
    label: 'Retracted',
    className: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/60',
  },
};

interface AlertGroup {
  borrower: string;
  dealIds: string[];
  messages: Message[];
  latestMessage: Message;
  headline: string;
  bookrunners: string;
  bookrunnersFull: string;
  stage: DealStage;
  publishStatus: PublishStatus;
}

export default function MessagesPage() {
  const { messages, deals, users, sendMessage, retractMessage, updateMessage, currentUser, createMessage, updateDeal, updateDealStage, deleteMessage, chatChannels, chatMessages } = useScopedApp();
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'history' | 'data' | 'checker' | null>('history');
  const [editSignals, setEditSignals] = useState<Record<string, number>>({});
  const [flashingBtn, setFlashingBtn] = useState<string | null>(null);
  const [docsGroup, setDocsGroup] = useState<AlertGroup | null>(null);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterPublish, setFilterPublish] = useState<'all' | PublishStatus>('all');
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [chatView, setChatView] = useState<'closed' | 'floating' | 'modal'>('closed');
  const showChat = chatView !== 'closed';
  const [editingHeadlineId, setEditingHeadlineId] = useState<string | null>(null);
  const [headlineDraft, setHeadlineDraft] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingBorrowerKey, setEditingBorrowerKey] = useState<string | null>(null);
  const [borrowerDraft, setBorrowerDraft] = useState('');
  const [editingBookrunnersKey, setEditingBookrunnersKey] = useState<string | null>(null);
  const [bookrunnersDraft, setBookrunnersDraft] = useState('');
  const panelTapRef = useRef<{ key: string; time: number; x: number; y: number } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const canManageMessages = currentUser.role === 'syndicate_admin' || currentUser.role === 'master_admin';
  const isReadOnly = currentUser.role === 'syndicate_readonly' || currentUser.role === 'sales_readonly' || currentUser.role === 'vendor_user';

  // Esc cascade: if a deal row is expanded but no inner alert card is open
  // (and no modal owns Esc), collapse the deal row back to the Issue Board list.
  useEffect(() => {
    if (!expandedAlertId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (document.querySelector('[data-alert-card-expanded="true"]')) return;
      setExpandedAlertId(null);
    };
    const onEditorClosed = () => setExpandedAlertId(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('alert-editor-closed', onEditorClosed);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('alert-editor-closed', onEditorClosed);
    };
  }, [expandedAlertId]);


  // Esc from Focus Mode returns to the full New Issue Board. Any open dialog
  // or expanded alert card owns Esc first (existing cascade preserved).
  useEffect(() => {
    if (!focusedKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      setFocusedKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedKey]);

  // --- Focus Mode: focus management + keyboard navigation -------------------
  const overlayRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const activeListItemRef = useRef<HTMLButtonElement | null>(null);

  // Move focus into the overlay on open; restore it to the trigger on close.
  useEffect(() => {
    if (!focusedKey) {
      const el = returnFocusRef.current;
      returnFocusRef.current = null;
      if (el && document.contains(el)) {
        requestAnimationFrame(() => el.focus());
      }
      return;
    }
    const t = requestAnimationFrame(() => {
      (activeListItemRef.current || overlayRef.current)?.focus();
    });
    return () => cancelAnimationFrame(t);
    // Only run on enter/exit of Focus Mode, not on every deal switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedKey === null]);

  // Trap Tab inside the overlay while Focus Mode is open.
  useEffect(() => {
    if (!focusedKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = overlayRef.current;
      if (!root) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
        )
      ).filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!nodes.length) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (!current || !root.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [focusedKey]);


  // Group messages by their primary deal (first dealId) to create alert groups
  const alertGroups: AlertGroup[] = [];
  const dealGroupMap = new Map<string, Message[]>();

  // Only show message threads whose linked deal is visible in the current
  // user's scope. Without this, syndicate users can see "orphan" rows where
  // the message exists but the linked deal is filtered out — producing rows
  // with missing borrower/bookrunner/stage data and inconsistent display
  // between sessions/environments.
  const visibleDealIds = new Set(deals.map(d => d.id));
  const visibleMessages = messages.filter(m => {
    if (isReadOnly) {
      // Vendors / read-only roles only ever see PUBLISHED (sent) alerts —
      // pre-published drafts must never leak out of the syndicate.
      if (m.status !== 'sent') return false;
      return m.recipients.includes(currentUser.id) || m.senderId === currentUser.id;
    }
    // Master Admin sees all deals (scopeDeals returns all), so this is a no-op for them.
    // Syndicate Admins only see threads tied to their own org's visible deals.
    // Messages with no linked deal at all are kept (genuine standalone alerts).
    if (m.dealIds.length === 0) return true;
    return m.dealIds.some(id => visibleDealIds.has(id));
  });

  visibleMessages.forEach(m => {
    const key = m.dealIds.join(',');
    if (!dealGroupMap.has(key)) dealGroupMap.set(key, []);
    dealGroupMap.get(key)!.push(m);
  });

  dealGroupMap.forEach((msgs, key) => {
    const dealIds = key.split(',').filter(Boolean);
    const sorted = [...msgs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const primaryDeal = dealIds.length > 0 ? deals.find(d => d.id === dealIds[0]) : undefined;

    const borrower = primaryDeal?.issuerName || sorted[0].subject.split(/\s+/).slice(0, 3).join(' ') || 'Unlinked';
    const bookrunnerNames = primaryDeal?.bookrunners?.map(b => b.name).join(', ') || '';

    alertGroups.push({
      borrower,
      dealIds,
      messages: sorted,
      latestMessage: sorted[0],
      headline: sorted[0].subject,
      bookrunners: bookrunnerNames.length > 30 ? bookrunnerNames.slice(0, 28) + '...' : bookrunnerNames,
      bookrunnersFull: bookrunnerNames,
      stage: primaryDeal?.stage || 'Mandate',
      publishStatus: publishStatusOf(sorted[0]),
    });
  });

  // Sort by latest update
  alertGroups.sort((a, b) => b.latestMessage.updatedAt.getTime() - a.latestMessage.updatedAt.getTime());

  // Filter by publish status (primary) and stage (secondary)
  const stageFiltered = filterStage === 'all'
    ? alertGroups
    : alertGroups.filter(g => filterStage === 'Pipeline' ? (g.stage === 'Mandate' || g.stage === 'Launched') : g.stage === filterStage);
  const filtered = filterPublish === 'all'
    ? stageFiltered
    : stageFiltered.filter(g => g.publishStatus === filterPublish);

  const publishCounts = {
    all: alertGroups.length,
    pre_published: alertGroups.filter(g => g.publishStatus === 'pre_published').length,
    published: alertGroups.filter(g => g.publishStatus === 'published').length,
    retracted: alertGroups.filter(g => g.publishStatus === 'retracted').length,
  };

  // Auto-expand deal when arriving from Termsheet Data panel via ?dealId=
  useEffect(() => {
    const dealId = searchParams.get('dealId');
    if (!dealId) return;
    const group = alertGroups.find(g => g.dealIds.includes(dealId));
    if (group) {
      const groupKey = group.dealIds.join(',');
      setExpandedAlertId(groupKey);
      setActivePanel('history');
    }
  }, [searchParams, alertGroups]);

  // Backfill: if an existing deal's stage is behind what its latest message
  // body says (e.g. subject contains "PRICED" but deal is still at Mandate),
  // auto-advance the deal stage. Runs once per (deal, message signature).
  const stageBackfillRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!canManageMessages) return;
    for (const group of alertGroups) {
      const dealId = group.dealIds[0];
      if (!dealId) continue;
      const deal = deals.find(d => d.id === dealId);
      if (!deal) continue;
      const msg = group.latestMessage;
      const sig = `${dealId}:${msg.id}:${deal.stage}`;
      if (stageBackfillRef.current.has(sig)) continue;
      const detected = detectStage(`${msg.subject}\n${stripHtml(msg.body)}`);
      if (detected && isStageForward(deal.stage, detected)) {
        stageBackfillRef.current.add(sig);
        updateDealStage(dealId, detected, 'Auto-detected from latest alert');
      } else {
        stageBackfillRef.current.add(sig);
      }
    }
  }, [alertGroups, deals, canManageMessages, updateDealStage]);

  // "E" keyboard shortcut: when a deal row is expanded and no modal/input is
  // focused, open the full-screen editor for the latest update.
  useEffect(() => {
    if (!expandedAlertId || !canManageMessages) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'e' && e.key !== 'E') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const group = alertGroups.find(g => g.dealIds.join(',') === expandedAlertId);
      if (!group || group.latestMessage.status === 'retracted') return;
      e.preventDefault();
      const id = group.latestMessage.id;
      setActivePanel('history');
      setEditSignals(s => ({ ...s, [id]: (s[id] || 0) + 1 }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedAlertId, canManageMessages, alertGroups]);

  const toggleExpand = (id: string) => {
    setExpandedAlertId(prev => {
      const next = prev === id ? null : id;
      if (next) setActivePanel('history');
      return next;
    });
  };

  // Focus Mode: full-screen single-deal view with the board list on the left.
  const openFocus = (key: string) => {
    // Remember where focus came from so Esc can return it to the board row.
    if (!focusedKey) {
      const el = document.activeElement as HTMLElement | null;
      returnFocusRef.current = el && el !== document.body ? el : null;
    }
    setActivePanel('history');
    setFocusedKey(key);
  };

  const flash = (key: string) => {
    setFlashingBtn(key);
    setTimeout(() => setFlashingBtn(prev => (prev === key ? null : prev)), 500);
  };

  const handleOpenChat = (dealIds: string[], opts?: { modal?: boolean; toggle?: boolean }) => {
    const dealId = dealIds[0];
    // Re-click the same deal box → close
    if (opts?.toggle && chatView !== 'closed' && activeDealId === dealId && !opts.modal) {
      setChatView('closed');
      return;
    }
    setActiveDealId(dealId);
    setChatView(opts?.modal ? 'modal' : (chatView === 'modal' ? 'modal' : 'floating'));
    chatSeenRef.current[dealIds.join(',')] = Date.now();
  };


  // Per-deal unread chat count. Session baseline: messages newer than mount
  // count as unread until the user opens the deal chat panel for that deal.
  const chatSeenRef = useRef<Record<string, number>>({});
  const mountTimeRef = useRef<number>(Date.now());
  const getUnreadChatCount = (dealIds: string[]) => {
    const channelIds = chatChannels.filter(c => c.dealId && dealIds.includes(c.dealId)).map(c => c.id);
    if (channelIds.length === 0) return 0;
    const baseline = mountTimeRef.current;
    const dealKey = dealIds.join(',');
    const seen = chatSeenRef.current[dealKey] ?? baseline;
    return chatMessages.filter(m =>
      channelIds.includes(m.channelId) &&
      m.senderId !== currentUser.id &&
      m.timestamp.getTime() > seen,
    ).length;
  };

  const shouldIgnorePanelCloseGesture = (target: HTMLElement) =>
    !!target.closest('button, a, input, textarea, select, [contenteditable="true"], .tiptap, [role="dialog"], [data-headline-editor], [data-borrower-editor]');

  const handlePanelTapClose = (groupKey: string, e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (shouldIgnorePanelCloseGesture(target)) {
      panelTapRef.current = null;
      return;
    }

    const now = window.performance.now();
    const last = panelTapRef.current;
    const x = e.clientX;
    const y = e.clientY;
    if (last && last.key === groupKey && now - last.time < 550 && Math.hypot(x - last.x, y - last.y) < 32) {
      panelTapRef.current = null;
      setExpandedAlertId(null);
      return;
    }
    panelTapRef.current = { key: groupKey, time: now, x, y };
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'System';
  const getRecipientNames = (ids: string[]) => ids.map(id => getUserName(id)).join(', ');

  const buildSuggestions = (msg: Message): string[] => {
    const ai = simulateAIExtraction(`${msg.subject}\n${stripHtml(msg.body)}`);
    const deal = msg.dealIds.length ? deals.find(d => d.id === msg.dealIds[0]) : undefined;
    const borrower = ai.borrowerDetails || deal?.issuerName || 'Issuer';
    const ccy = ai.keyTerms.Currency || deal?.currency || '';
    const tenor = ai.keyTerms.Tenor || deal?.tenor || '';
    const stage = deal?.stage || 'Mandate';
    const candidates = [
      `${borrower} — ${stage}`,
      `${borrower} ${ccy} ${tenor} — ${stage}`.replace(/\s+/g, ' ').trim(),
      `${borrower} ${ccy} ${tenor} New Issue Alert`.replace(/\s+/g, ' ').trim(),
      ai.headline,
    ];
    const seen = new Set<string>();
    return candidates.filter(c => c && !seen.has(c) && (seen.add(c), true) && c.toLowerCase().includes(headlineDraft.toLowerCase()));
  };

  const saveHeadline = () => {
    if (editingHeadlineId && headlineDraft.trim() && headlineDraft !== messages.find(m => m.id === editingHeadlineId)?.subject) {
      updateMessage(editingHeadlineId, { subject: headlineDraft.trim() });
    }
    setEditingHeadlineId(null);
    setShowSuggestions(false);
  };

  const saveBorrower = (group: AlertGroup) => {
    const trimmed = borrowerDraft.trim();
    if (trimmed && trimmed !== group.borrower && group.dealIds[0]) {
      updateDeal(group.dealIds[0], { issuerName: trimmed });
    }
    setEditingBorrowerKey(null);
  };

  const saveBookrunners = (group: AlertGroup) => {
    const dealId = group.dealIds[0];
    if (!dealId) { setEditingBookrunnersKey(null); return; }
    const names = bookrunnersDraft.split(',').map(s => s.trim()).filter(Boolean);
    const existing = deals.find(d => d.id === dealId)?.bookrunners || [];
    const next = names.map(n => {
      const prior = existing.find(b => b.name.toLowerCase() === n.toLowerCase());
      return prior ? { ...prior, name: n } : { name: n, role: 'passive' as const, isGlobalCoordinator: false };
    });
    if (JSON.stringify(next) !== JSON.stringify(existing)) {
      updateDeal(dealId, { bookrunners: next });
    }
    setEditingBookrunnersKey(null);
  };

  const handlePostUpdate = (originalId: string, edits: { subject: string; body: string }) => {
    const original = messages.find(m => m.id === originalId);
    if (!original) return;
    const newDraft = createMessage({
      dealIds: original.dealIds,
      subject: edits.subject,
      body: edits.body,
      status: 'draft',
      senderId: currentUser.id,
      recipients: original.recipients,
      attachments: original.attachments,
      threadId: original.threadId ?? original.id,
      parentMessageId: original.id,
    });
    // Re-parse and merge into the parent deal(s)
    for (const dealId of original.dealIds) {
      const deal = deals.find(d => d.id === dealId);
      if (!deal) continue;
      const { patch, detectedStage } = mergeDealFromText(deal, `${edits.subject}\n${stripHtml(edits.body)}`);
      if (Object.keys(patch).length > 0) updateDeal(dealId, patch);
      if (detectedStage && isStageForward(deal.stage, detectedStage)) {
        updateDealStage(dealId, detectedStage, 'Auto-detected from alert update');
      }
    }
    sendMessage(newDraft.id);
    toast({ title: 'Update Sent', description: `Sent to ${original.recipients.length} recipient${original.recipients.length !== 1 ? 's' : ''}.` });
  };


  const renderDealActions = (group: AlertGroup, groupKey: string) => (
    <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/50 flex-wrap">
      <Button
        size="default"
        variant="outline"
        className={`toolbar-btn ${flashingBtn === `${groupKey}:data` ? 'animate-border-flash' : ''}`}
        disabled={!group.dealIds[0]}
        onClick={(e) => {
          e.stopPropagation();
          flash(`${groupKey}:data`);
          const did = group.dealIds[0];
          if (did) setTimeout(() => navigate(`/deals?dealId=${did}`), 150);
        }}
      >
        <Database className="h-4 w-4 mr-1" />
        Termsheet Data
      </Button>
      {canManageMessages && group.messages.length > 0 && group.latestMessage.status !== 'retracted' && (
        <Button
          size="default"
          variant="outline"
          className="toolbar-btn"
          title="Edit the latest update"
          onClick={(e) => {
            e.stopPropagation();
            const id = group.latestMessage.id;
            setActivePanel('history');
            setEditSignals(s => ({ ...s, [id]: (s[id] || 0) + 1 }));
          }}
        >
          <Edit2 className="h-4 w-4 mr-1" />
          Edit Latest
        </Button>
      )}
      {canManageMessages && group.messages.length > 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <ExtractDealFromChatButton
            size="default"
            source="thread"
            messages={group.messages}
            conversationLabel={group.headline || group.borrower}
            targetDealIds={group.dealIds}
            className="toolbar-btn-ai"
          />
        </div>
      )}
      {group.dealIds.length > 0 && (() => {
        const unread = getUnreadChatCount(group.dealIds);
        return (
          <Button
            size="default"
            variant="outline"
            className={`toolbar-btn ${flashingBtn === `${groupKey}:openchat` ? 'animate-border-flash' : ''}`}
            title={unread > 0 ? `Open Chat — ${unread} unread` : 'Open Chat'}
            onClick={(e) => {
              e.stopPropagation();
              flash(`${groupKey}:openchat`);
              handleOpenChat(group.dealIds, { modal: true });
            }}
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Chat{unread > 0 ? ` (${unread})` : ''}
          </Button>
        );
      })()}
      <Button
        size="default"
        variant="outline"
        className="toolbar-btn"
        title="OrderBook (coming soon)"
        onClick={(e) => {
          e.stopPropagation();
          toast({ title: 'OrderBook', description: 'OrderBook module coming soon.' });
        }}
      >
        <BookOpen className="h-4 w-4 mr-1" />
        OrderBook
      </Button>
      {(() => {
        const docCount = group.messages.reduce((n, m) => n + (m.attachments?.length ?? 0), 0);
        return (
          <Button
            size="default"
            variant="outline"
            className="toolbar-btn"
            title="View attached documentation"
            onClick={(e) => { e.stopPropagation(); setDocsGroup(group); }}
          >
            <FileText className="h-4 w-4 mr-1" />
            Docs{docCount > 0 ? ` (${docCount})` : ''}
          </Button>
        );
      })()}
      {group.dealIds[0] && (
        <Button
          size="default"
          variant="outline"
          aria-pressed={activePanel === 'checker'}
          className={`toolbar-btn ${activePanel === 'checker' ? 'toolbar-btn-selected' : ''}`}
          title="AI Deal Checker"
          onClick={(e) => { e.stopPropagation(); setActivePanel(p => p === 'checker' ? null : 'checker'); }}
        >
          <Shield className="h-4 w-4 mr-1" />
          Deal Checker
          <DealCheckFlag deal={deals.find(d => d.id === group.dealIds[0])} className="ml-1.5" />
        </Button>
      )}
      <Button
        size="default"
        variant="outline"
        aria-pressed={activePanel === 'history'}
        className={`toolbar-btn ${activePanel === 'history' ? 'toolbar-btn-selected' : ''} ${flashingBtn === `${groupKey}:history` ? 'animate-border-flash' : ''}`}
        onClick={(e) => { e.stopPropagation(); flash(`${groupKey}:history`); setActivePanel(p => p === 'history' ? null : 'history'); }}
      >
        <History className="h-4 w-4 mr-1" />
        History ({group.messages.length})
      </Button>
    </div>
  );

  const renderDealDetail = (group: AlertGroup, groupKey: string) => (
                  <div
                    className="bg-card/40 border-t border-border px-8 py-4 space-y-4"
                    title="Double-click or double-tap empty area to close"
                    onClick={(e) => handlePanelTapClose(groupKey, e)}
                    onDoubleClick={(e) => {
                      const t = e.target as HTMLElement;
                      // Ignore double-clicks on interactive / editable controls
                      if (shouldIgnorePanelCloseGesture(t)) return;
                      panelTapRef.current = null;
                      setExpandedAlertId(null);
                    }}
                  >
                    {renderDealActions(group, groupKey)}
                    {activePanel === 'checker' && group.dealIds[0] && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <DealChecker
                          deal={deals.find(d => d.id === group.dealIds[0])}
                          userRole={currentUser?.role}
                          currentUserId={currentUser?.id}
                          currentUserName={currentUser?.name}
                        />
                      </div>
                    )}
                    {activePanel === 'history' && (
                      <div className="space-y-4">
                        {(() => {
                          const total = group.messages.length;
                          const renderCard = (msg: typeof group.messages[number], idx: number) => {
                            const versionNum = total - idx;
                            const versionLabel = total > 1
                              ? (versionNum === 1 ? 'Original' : `Update #${versionNum - 1}`)
                              : undefined;
                            return (
                              <AlertHistoryCard
                                key={msg.id}
                                message={msg}
                                senderName={getUserName(msg.senderId)}
                                recipientNames={getRecipientNames(msg.recipients)}
                                canManage={canManageMessages}
                                versionLabel={versionLabel}
                                isLatest={idx === 0}
                                editSignal={editSignals[msg.id] || 0}
                                onUpdate={updateMessage}
                                onRetract={(id) => {
                                  retractMessage(id);
                                  toast({ title: 'Alert Retracted', description: 'The alert has been retracted.' });
                                }}
                                onSend={(id) => {
                                  sendMessage(id);
                                  const m = messages.find(x => x.id === id);
                                  toast({ title: 'Alert Sent', description: `Sent to ${m?.recipients.length || 0} recipients` });
                                }}
                                onPostUpdate={handlePostUpdate}
                                onDelete={(id) => {
                                  deleteMessage(id);
                                  toast({ title: 'Alert Deleted', description: 'The alert has been removed.' });
                                }}
                              />
                            );
                          };
                          const latest = group.messages[0];
                          const rest = group.messages.slice(1);
                          return (
                            <>
                              {latest && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {group.messages.length > 1 && (
                                      <span className="text-[10px] font-semibold uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                        Update #{group.messages.length - 1}
                                      </span>
                                    )}
                                    <span>{getUserName(latest.senderId)}</span>
                                  </div>
                                  <AlertHistoryCard
                                    key={latest.id}
                                    message={latest}
                                    senderName={getUserName(latest.senderId)}
                                    recipientNames={getRecipientNames(latest.recipients)}
                                    canManage={canManageMessages}
                                    isLatest
                                    embedded
                                    editSignal={editSignals[latest.id] || 0}
                                    onUpdate={updateMessage}
                                    onRetract={(id) => {
                                      retractMessage(id);
                                      toast({ title: 'Alert Retracted', description: 'The alert has been retracted.' });
                                    }}
                                    onSend={(id) => {
                                      sendMessage(id);
                                      const m = messages.find(x => x.id === id);
                                      toast({ title: 'Alert Sent', description: `Sent to ${m?.recipients.length || 0} recipients` });
                                    }}
                                    onPostUpdate={handlePostUpdate}
                                    onDelete={(id) => {
                                      deleteMessage(id);
                                      toast({ title: 'Alert Deleted', description: 'The alert has been removed.' });
                                    }}
                                  />
                                </div>
                              )}
                              {rest.map((msg, i) => renderCard(msg, i + 1))}
                            </>
                          );
                        })()}
                      </div>
                    )}

                  </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Issue Board</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {canManageMessages && (
            <Button
              onClick={() => navigate('/ai-draft')}
              className="px-3 py-1 h-auto rounded text-xs font-medium bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create New Issue
            </Button>
          )}
          {/* Publish status filter — primary partition between Pre-Published and Published */}
          <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border">
            {(['all', 'pre_published', 'published', 'retracted'] as const).map(s => {
              const labels = {
                all: 'All',
                pre_published: 'Pre-Published',
                published: 'Published',
                retracted: 'Retracted',
              } as const;
              const count = publishCounts[s];
              const active = filterPublish === s;
              if (s === 'retracted' && count === 0) return null;
              return (
                <button
                  key={s}
                  onClick={() => setFilterPublish(s)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s !== 'all' && (
                    <span className={`h-1.5 w-1.5 rounded-full ${publishStatusBadge[s].dot}`} />
                  )}
                  {labels[s]}
                  <span className={`text-[10px] ${active ? 'opacity-80' : 'opacity-60'}`}>{count}</span>
                </button>
              );
            })}
          </div>
          {/* Stage filter — secondary */}
          <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border">
            {['all', 'Pipeline', 'Priced'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStage(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filterStage === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'All stages' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1">
        <div>
          {/* Table header */}

          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            <div className="col-span-1"></div>
            <div className="col-span-1 text-center">Public Status</div>
            <div className="col-span-1">Chat</div>
            <div className="col-span-2">Last Updated</div>
            <div className="col-span-2">Borrower</div>
            <div className="col-span-4">Headline</div>
            <div className="col-span-1">Stage</div>
          </div>


          {/* Alert rows */}
          <div className="divide-y divide-border">
            {filtered.map(group => {
              const groupKey = group.dealIds.join(',');
              const isExpanded = expandedAlertId === groupKey;
              const badge = stageBadge[group.stage];
              const pubBadge = publishStatusBadge[group.publishStatus];

              return (
                <div key={groupKey}>
                  {/* Main row */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Open deal ${group.borrower}: ${group.headline}`}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer transition-colors hover:bg-amber-500/10 hover:ring-1 hover:ring-inset hover:ring-amber-400/50 ${group.publishStatus === 'pre_published' ? 'border-l-2 border-l-amber-500/60' : group.publishStatus === 'published' ? 'border-l-2 border-l-green-500/60' : 'border-l-2 border-l-transparent'}`}
                    onClick={(e) => {
                      // Don't toggle when interacting with the inline headline editor
                      if ((e.target as HTMLElement).closest('[data-headline-editor]')) return;
                      if ((e.target as HTMLElement).closest('[data-borrower-editor]')) return;
                      returnFocusRef.current = e.currentTarget as HTMLElement;
                      openFocus(groupKey);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      const t = e.target as HTMLElement;
                      if (t !== e.currentTarget) return;
                      e.preventDefault();
                      returnFocusRef.current = e.currentTarget as HTMLElement;
                      openFocus(groupKey);
                    }}
                  >
                    <div className="col-span-1 flex items-center gap-1">
                      <button
                        type="button"
                        title={isExpanded ? 'Collapse inline preview' : 'Expand inline preview'}
                        aria-label={isExpanded ? 'Collapse inline preview' : 'Expand inline preview'}
                        onClick={(e) => { e.stopPropagation(); toggleExpand(groupKey); }}
                        className="p-0.5 -m-0.5 rounded hover:bg-accent/40"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                    <div className="col-span-1 flex justify-center items-center gap-1.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${pubBadge.dot}`}
                        title={pubBadge.label}
                      />
                      <DealCheckFlag deal={deals.find(d => d.id === group.dealIds[0])} />
                    </div>
                    <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const unread = getUnreadChatCount(group.dealIds);
                        const isActive = showChat && activeDealId === group.dealIds[0];
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              flash(`${groupKey}:chat`);
                              handleOpenChat(group.dealIds, { modal: e.shiftKey, toggle: true });
                            }}
                            title={unread > 0 ? `Open Chat — ${unread} unread (Shift-click for dialog)` : 'Open Chat (Shift-click for dialog)'}
                            aria-label="Open Chat"
                            className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              isActive
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                            } ${flashingBtn === `${groupKey}:chat` ? 'animate-border-flash' : ''}`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {unread > 0 && (
                              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-[14px] text-center">
                                {unread > 9 ? '9+' : unread}
                              </span>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                    <div className="col-span-2 text-timestamp text-sm">
                      {format(group.latestMessage.updatedAt, 'MMM d, hh:mm a')}
                    </div>
                    <div className="col-span-2 font-medium text-sm" data-borrower-editor onClick={(e) => e.stopPropagation()}>
                      {canManageMessages && editingBorrowerKey === groupKey ? (
                        <Input
                          autoFocus
                          value={borrowerDraft}
                          onChange={(e) => setBorrowerDraft(e.target.value)}
                          onBlur={() => saveBorrower(group)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveBorrower(group); }
                            if (e.key === 'Escape') { setEditingBorrowerKey(null); }
                          }}
                          className="h-7 text-sm"
                        />
                      ) : (
                        <span
                          className={canManageMessages ? 'cursor-text hover:bg-background/50 rounded px-1 -mx-1' : ''}
                          onClick={() => {
                            if (!canManageMessages || !group.dealIds[0]) return;
                            setEditingBorrowerKey(groupKey);
                            setBorrowerDraft(group.borrower);
                          }}
                          title={canManageMessages ? 'Click to edit borrower name' : ''}
                        >
                          {group.borrower}
                        </span>
                      )}
                    </div>

                    <div className="col-span-4 text-sm text-muted-foreground truncate relative" data-headline-editor onClick={(e) => e.stopPropagation()}>
                      {canManageMessages && editingHeadlineId === group.latestMessage.id ? (
                        <div className="relative">
                          <Input
                            autoFocus
                            value={headlineDraft}
                            onChange={(e) => { setHeadlineDraft(e.target.value); setShowSuggestions(true); }}
                            onBlur={() => setTimeout(() => saveHeadline(), 150)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); saveHeadline(); }
                              if (e.key === 'Escape') { setEditingHeadlineId(null); setShowSuggestions(false); }
                            }}
                            className="h-7 text-sm"
                          />
                          {showSuggestions && (() => {
                            const sugs = buildSuggestions(group.latestMessage).slice(0, 4);
                            if (sugs.length === 0) return null;
                            return (
                              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                                {sugs.map((s, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); setHeadlineDraft(s); }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <span
                          className={canManageMessages ? 'cursor-text hover:bg-background/50 rounded px-1 -mx-1' : ''}
                          onClick={() => {
                            if (!canManageMessages) return;
                            setEditingHeadlineId(group.latestMessage.id);
                            setHeadlineDraft(group.headline);
                            setShowSuggestions(true);
                          }}
                          title={canManageMessages ? 'Click to edit headline' : ''}
                        >
                          {group.headline}
                        </span>
                      )}
                    </div>
                    <div className="col-span-1 flex items-center gap-1">
                      <Badge className={`text-[10px] border ${badge.className}`}>
                        {badge.label}
                      </Badge>
                      {isExpanded && canManageMessages && group.latestMessage.status !== 'retracted' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 ml-auto"
                          title="Edit latest update (E)"
                          onClick={(e) => {
                            e.stopPropagation();
                            const id = group.latestMessage.id;
                            setActivePanel('history');
                            setEditSignals(s => ({ ...s, [id]: (s[id] || 0) + 1 }));
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && renderDealDetail(group, groupKey)}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No alerts found</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t border-border mt-2">
            <span>Showing {filtered.length} deal{filtered.length !== 1 ? 's' : ''}</span>
            <span>Updated just now</span>
          </div>
        </div>

      </div>

      {/* Floating chat panel (default) */}
      {focusedKey && (() => {
        const fg = (filtered.find(g => g.dealIds.join(',') === focusedKey)
          || alertGroups.find(g => g.dealIds.join(',') === focusedKey));
        if (!fg) return null;
        const list = filtered.length ? filtered : alertGroups;
        return (
          <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Deal focus view: ${fg.borrower}`}
            tabIndex={-1}
            className="fixed inset-0 z-40 flex bg-background outline-none"
          >
            {/* Deal list — takes the place of the app menu */}
            <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
              <div className="p-3 border-b border-sidebar-border">
                <div className="text-sm font-bold">New Issue Board</div>
                <div className="text-[11px] text-sidebar-foreground/60">↑↓ to browse · Esc to return to the board</div>
              </div>
              <div
                role="listbox"
                aria-label="Deals on the New Issue Board"
                className="flex-1 overflow-auto p-2 space-y-1"
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
                  e.preventDefault();
                  const keys = list.map(g => g.dealIds.join(','));
                  const i = keys.indexOf(focusedKey);
                  let next = i;
                  if (e.key === 'ArrowDown') next = Math.min(keys.length - 1, i + 1);
                  else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
                  else if (e.key === 'Home') next = 0;
                  else next = keys.length - 1;
                  if (next !== i && keys[next]) {
                    setActivePanel('history');
                    setFocusedKey(keys[next]);
                    requestAnimationFrame(() => activeListItemRef.current?.focus());
                  }
                }}
              >
                {list.map(g => {
                  const key = g.dealIds.join(',');
                  const active = key === focusedKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={active}
                      tabIndex={active ? 0 : -1}
                      ref={active ? (el) => { activeListItemRef.current = el; el?.scrollIntoView({ block: 'nearest' }); } : undefined}
                      onClick={() => openFocus(key)}
                      className={`w-full text-left rounded-md px-2.5 py-2 transition-colors ${
                        active
                          ? 'border-2 border-amber-400 bg-amber-500/10 ring-1 ring-amber-400/50'
                          : 'border-2 border-transparent hover:border-amber-400/40 hover:bg-amber-500/5'
                      }`}
                    >
                      <div className={`text-xs ${active ? 'font-bold text-amber-300' : 'font-medium'}`}>{g.borrower}</div>
                      <div className="text-[11px] text-sidebar-foreground/60 line-clamp-2">{g.headline}</div>
                      <Badge className={`mt-1 text-[9px] border ${stageBadge[g.stage].className}`}>{stageBadge[g.stage].label}</Badge>
                    </button>
                  );
                })}
              </div>
            </aside>
            {/* Focused deal */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-12 shrink-0 border-b border-border bg-card flex items-center gap-3 px-4 overflow-hidden">
                <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                  <div className="text-lg leading-6 font-bold text-foreground truncate">{fg.borrower}</div>
                  <div className="text-sm leading-5 font-bold text-amber-300 truncate">{fg.headline}</div>
                </div>
                <Badge className={`text-sm border ${stageBadge[fg.stage].className}`}>{stageBadge[fg.stage].label}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setFocusedKey(null)}
                >
                  Back to board (Esc)
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                {renderDealDetail(fg, focusedKey)}
              </div>
            </div>
          </div>
        );
      })()}

      {chatView === 'floating' && (
        <FloatingChatPanel
          activeDealId={activeDealId}
          onClose={() => setChatView('closed')}
          onExpandToModal={() => setChatView('modal')}
        />
      )}

      {/* Modal chat dialog */}
      <ChatModalDialog
        open={chatView === 'modal'}
        activeDealId={activeDealId}
        onClose={() => setChatView('closed')}
        onCollapseToPanel={() => setChatView('floating')}
      />


      <Dialog open={!!docsGroup} onOpenChange={(o) => !o && setDocsGroup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Attachments{docsGroup ? ` — ${docsGroup.headline || docsGroup.borrower}` : ''}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const docs = (docsGroup?.messages ?? []).flatMap(m => (m.attachments ?? []).map(a => ({ a, m })));
            if (docs.length === 0) {
              return <p className="text-sm text-muted-foreground py-4">No documentation attached to this deal.</p>;
            }
            return (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Attachments ({docs.length})
                </p>
                {docs.map(({ a, m }) => (
                  <a
                    key={a.id}
                    href={a.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2 hover:bg-accent/40 transition-colors"
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate flex-1">{a.name}</span>
                    <span className="text-[10px] uppercase text-muted-foreground shrink-0">
                      {format(m.createdAt, 'dd MMM yyyy')}
                    </span>
                  </a>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
