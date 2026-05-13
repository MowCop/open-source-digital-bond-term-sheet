import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useScopedApp } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Message, DealStage } from '@/types/bond';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, Plus, MessageSquare, Trash2, Database, History } from 'lucide-react';
import SecureChat from '@/components/SecureChat';
import AlertHistoryCard from '@/components/AlertHistoryCard';
import { useToast } from '@/hooks/use-toast';
import { mergeDealFromText, isStageForward, simulateAIExtraction } from '@/lib/alertParsing';

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
  const { messages, deals, users, sendMessage, retractMessage, updateMessage, currentUser, createMessage, updateDeal, updateDealStage, deleteMessage, deleteDeal } = useScopedApp();
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'history' | 'data' | null>('history');
  const [flashingBtn, setFlashingBtn] = useState<string | null>(null);
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
  const { toast } = useToast();
  const navigate = useNavigate();

  const canManageMessages = currentUser.role === 'syndicate_admin' || currentUser.role === 'master_admin';
  const isReadOnly = currentUser.role === 'syndicate_readonly' || currentUser.role === 'sales_readonly' || currentUser.role === 'vendor_user';

  // Group messages by their primary deal (first dealId) to create alert groups
  const alertGroups: AlertGroup[] = [];
  const dealGroupMap = new Map<string, Message[]>();

  const visibleMessages = messages.filter(m => {
    if (isReadOnly) return m.recipients.includes(currentUser.id) || m.senderId === currentUser.id;
    return true;
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
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;
  const getRecipientNames = (ids: string[]) => ids.map(id => getUserName(id)).join(', ');

  const buildSuggestions = (msg: Message): string[] => {
    const ai = simulateAIExtraction(`${msg.subject}\n${msg.body}`);
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
      const { patch, detectedStage } = mergeDealFromText(deal, `${edits.subject}\n${edits.body}`);
      if (Object.keys(patch).length > 0) updateDeal(dealId, patch);
      if (detectedStage && isStageForward(deal.stage, detectedStage)) {
        updateDealStage(dealId, detectedStage, 'Auto-detected from alert update');
      }
    }
    sendMessage(newDraft.id);
    toast({ title: 'Update Sent', description: `Sent to ${original.recipients.length} recipient${original.recipients.length !== 1 ? 's' : ''}.` });
  };

  const handleDeleteThread = (group: AlertGroup) => {
    if (confirm(
      `Delete the entire deal "${group.borrower}" including ${group.messages.length} alert(s), its chat history, and all related notifications? This cannot be undone.`
    )) {
      group.dealIds.forEach(id => deleteDeal(id));
      toast({ title: 'Deal Deleted', description: `${group.borrower} and all related data removed.` });
      setExpandedAlertId(null);
    }
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
                      {canManageMessages && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); handleDeleteThread(group); }}
                          title="Delete entire alert thread"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="bg-card/40 border-t border-border px-8 py-4 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/50">
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
                      </div>

                      {activePanel === 'history' && (
                        <div className="space-y-4 mt-4">
                          {group.messages.map((msg, idx) => {
                            const total = group.messages.length;
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
                          })}
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
    </div>
  );
}
