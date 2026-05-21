import { useState, useRef, useEffect, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp, useScopedApp } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Message, DealStage } from '@/types/bond';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, Plus, MessageSquare, Trash2, Database, History, Edit2 } from 'lucide-react';
import SecureChat from '@/components/SecureChat';
import AlertHistoryCard from '@/components/AlertHistoryCard';
import { useToast } from '@/hooks/use-toast';
import { mergeDealFromText, isStageForward, simulateAIExtraction } from '@/lib/alertParsing';
import { stripHtml } from '@/lib/htmlText';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const stageBadge: Record<DealStage, { label: string; className: string }> = {
  Mandate: { label: 'Mandate', className: 'bg-blue-900/50 text-blue-400 border-blue-800' },
  Announced: { label: 'Announced', className: 'bg-blue-900/50 text-blue-400 border-blue-800' },
  Launched: { label: 'Launched', className: 'bg-green-900/50 text-green-400 border-green-800' },
  'Books Open': { label: 'Books Open', className: 'bg-green-900/50 text-green-400 border-green-800' },
  'Books Closed': { label: 'Books Closed', className: 'bg-green-900/50 text-green-400 border-green-800' },
  Priced: { label: 'Priced', className: 'bg-amber-900/50 text-amber-400 border-amber-800' },
  Settled: { label: 'Settled', className: 'bg-amber-900/50 text-amber-400 border-amber-800' },
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
}

export default function MessagesPage() {
  const { messages, deals, users, sendMessage, retractMessage, updateMessage, currentUser, createMessage, updateDeal, updateDealStage, deleteMessage, deleteDeal, chatChannels, chatMessages } = useScopedApp();
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'history' | 'data' | null>('history');
  const [editSignals, setEditSignals] = useState<Record<string, number>>({});
  const [flashingBtn, setFlashingBtn] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AlertGroup | null>(null);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
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
    if (isReadOnly) return m.recipients.includes(currentUser.id) || m.senderId === currentUser.id;
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
    });
  });

  // Sort by latest update
  alertGroups.sort((a, b) => b.latestMessage.updatedAt.getTime() - a.latestMessage.updatedAt.getTime());

  // Filter by stage
  const filtered = filterStage === 'all' ? alertGroups : alertGroups.filter(g => g.stage === filterStage);

  // Auto-expand deal when arriving from Deal Data panel via ?dealId=
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

  const flash = (key: string) => {
    setFlashingBtn(key);
    setTimeout(() => setFlashingBtn(prev => (prev === key ? null : prev)), 500);
  };

  const handleOpenChat = (dealIds: string[]) => {
    setActiveDealId(dealIds[0]);
    setShowChat(true);
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

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;
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

  const handleDeleteThread = (group: AlertGroup) => {
    setPendingDelete(group);
  };

  const confirmDeleteThread = () => {
    if (!pendingDelete) return;
    pendingDelete.dealIds.forEach(id => deleteDeal(id));
    toast({ title: 'Deal Deleted', description: `${pendingDelete.borrower} and all related data removed.` });
    setExpandedAlertId(null);
    setPendingDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Issue Board</h1>
        <div className="flex items-center gap-3">
          {/* Stage filter tabs */}
          <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border">
            {['all', 'Mandate', 'Launched', 'Priced'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStage(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filterStage === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${showChat ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <div className={showChat ? 'col-span-2' : ''}>
          {/* Create New Issue button */}
          {canManageMessages && (
            <div className="flex justify-center mb-4">
              <Button onClick={() => navigate('/ai-draft')} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Create New Issue
              </Button>
            </div>
          )}

          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            <div className="col-span-1"></div>
            <div className="col-span-2">Last Updated</div>
            <div className="col-span-2">Borrower</div>
            <div className="col-span-4">Headline</div>
            <div className="col-span-2">Bookrunners</div>
            <div className="col-span-1">Stage</div>
          </div>

          {/* Alert rows */}
          <div className="divide-y divide-border">
            {filtered.map(group => {
              const groupKey = group.dealIds.join(',');
              const isExpanded = expandedAlertId === groupKey;
              const badge = stageBadge[group.stage];

              return (
                <div key={groupKey}>
                  {/* Main row */}
                  <div
                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer hover:bg-card/60 transition-colors"
                    onClick={(e) => {
                      // Don't toggle when interacting with the inline headline editor
                      if ((e.target as HTMLElement).closest('[data-headline-editor]')) return;
                      if ((e.target as HTMLElement).closest('[data-borrower-editor]')) return;
                      toggleExpand(groupKey);
                    }}
                  >
                    <div className="col-span-1 flex items-center gap-1">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
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
                    <div className="col-span-2 text-sm text-muted-foreground truncate" onClick={(e) => e.stopPropagation()}>
                      {canManageMessages && editingBookrunnersKey === groupKey ? (
                        <Input
                          autoFocus
                          value={bookrunnersDraft}
                          onChange={(e) => setBookrunnersDraft(e.target.value)}
                          onBlur={() => saveBookrunners(group)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveBookrunners(group); }
                            if (e.key === 'Escape') { setEditingBookrunnersKey(null); }
                          }}
                          placeholder="Comma-separated names"
                          className="h-7 text-sm"
                        />
                      ) : (
                        <span
                          className={canManageMessages && group.dealIds[0] ? 'cursor-text hover:bg-background/50 rounded px-1 -mx-1 block truncate' : 'block truncate'}
                          onClick={() => {
                            if (!canManageMessages || !group.dealIds[0]) return;
                            setEditingBookrunnersKey(groupKey);
                            setBookrunnersDraft(group.bookrunnersFull);
                          }}
                          title={canManageMessages ? (group.bookrunnersFull || 'Click to add bookrunners') : group.bookrunnersFull}
                        >
                          {group.bookrunners || (canManageMessages ? <span className="italic opacity-60">Add bookrunners…</span> : '—')}
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
                  {isExpanded && (
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
                                <div className="flex items-center gap-2 py-2 border-y border-border/50 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`text-xs ${flashingBtn === `${groupKey}:chat` ? 'animate-border-flash' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); flash(`${groupKey}:chat`); handleOpenChat(group.dealIds); }}
                                  >
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    Deal Chat
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`text-xs ${flashingBtn === `${groupKey}:data` ? 'animate-border-flash' : ''}`}
                                    disabled={!group.dealIds[0]}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      flash(`${groupKey}:data`);
                                      const did = group.dealIds[0];
                                      if (did) setTimeout(() => navigate(`/deals?dealId=${did}`), 150);
                                    }}
                                  >
                                    <Database className="h-3 w-3 mr-1" />
                                    Deal Alert Data
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`text-xs ${activePanel === 'history' ? 'bg-accent text-accent-foreground' : ''} ${flashingBtn === `${groupKey}:history` ? 'animate-border-flash' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); flash(`${groupKey}:history`); setActivePanel(p => p === 'history' ? null : 'history'); }}
                                  >
                                    <History className="h-3 w-3 mr-1" />
                                    Update History ({group.messages.length})
                                  </Button>
                                  {canManageMessages && group.messages.length > 0 && group.latestMessage.status !== 'retracted' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      title="Edit the latest update"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const id = group.latestMessage.id;
                                        setActivePanel('history');
                                        setEditSignals(s => ({ ...s, [id]: (s[id] || 0) + 1 }));
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3 mr-1" />
                                      Edit Latest
                                    </Button>
                                  )}
                                  {canManageMessages && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs ml-auto border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteThread(group); }}
                                      title="Delete duplicate deal and all related data"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Delete
                                    </Button>
                                  )}
                                </div>
                                {rest.map((msg, i) => renderCard(msg, i + 1))}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {activePanel !== 'history' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs ${flashingBtn === `${groupKey}:chat` ? 'animate-border-flash' : ''}`}
                          onClick={(e) => { e.stopPropagation(); flash(`${groupKey}:chat`); handleOpenChat(group.dealIds); }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Deal Chat
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs ${flashingBtn === `${groupKey}:data` ? 'animate-border-flash' : ''}`}
                          disabled={!group.dealIds[0]}
                          onClick={(e) => {
                            e.stopPropagation();
                            flash(`${groupKey}:data`);
                            const did = group.dealIds[0];
                            if (did) setTimeout(() => navigate(`/deals?dealId=${did}`), 150);
                          }}
                        >
                          <Database className="h-3 w-3 mr-1" />
                          Deal Alert Data
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs ${flashingBtn === `${groupKey}:history` ? 'animate-border-flash' : ''}`}
                          onClick={(e) => { e.stopPropagation(); flash(`${groupKey}:history`); setActivePanel(p => p === 'history' ? null : 'history'); }}
                        >
                          <History className="h-3 w-3 mr-1" />
                          Update History ({group.messages.length})
                        </Button>
                        {canManageMessages && group.messages.length > 0 && group.latestMessage.status !== 'retracted' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            title="Edit the latest update"
                            onClick={(e) => {
                              e.stopPropagation();
                              const id = group.latestMessage.id;
                              setActivePanel('history');
                              setEditSignals(s => ({ ...s, [id]: (s[id] || 0) + 1 }));
                            }}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit Latest
                          </Button>
                        )}
                        {canManageMessages && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs ml-auto border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => { e.stopPropagation(); handleDeleteThread(group); }}
                            title="Delete duplicate deal and all related data"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                        </div>
                      )}
                    </div>
                  )}
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

        {/* Chat panel */}
        {showChat && (
          <div className="col-span-1">
            <div className="flex justify-end mb-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowChat(false)}>
                Close Chat ✕
              </Button>
            </div>
            <SecureChat activeDealId={activeDealId} />
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the deal
              {pendingDelete ? ` "${pendingDelete.borrower}"` : ''}, its
              {pendingDelete ? ` ${pendingDelete.messages.length}` : ''} alert(s), all related chat messages on My Deal Chats,
              the Deal Data entry, and any notifications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteThread}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete deal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
