import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Message, DealStage } from '@/types/bond';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, Plus, MessageSquare, Send } from 'lucide-react';
import SecureChat from '@/components/SecureChat';
import AlertHistoryCard from '@/components/AlertHistoryCard';
import { useToast } from '@/hooks/use-toast';

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
  stage: DealStage;
}

export default function MessagesPage() {
  const { messages, deals, users, sendMessage, retractMessage, updateMessage, currentUser, createMessage } = useApp();
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const { toast } = useToast();

  const canManageMessages = currentUser.role === 'syndicate_admin' || currentUser.role === 'master_admin';

  // Group messages by their primary deal (first dealId) to create alert groups
  const alertGroups: AlertGroup[] = [];
  const dealGroupMap = new Map<string, Message[]>();

  const visibleMessages = messages.filter(m => {
    if (currentUser.role === 'vendor_user') return m.recipients.includes(currentUser.id) || m.senderId === currentUser.id;
    return true;
  });

  visibleMessages.forEach(m => {
    const key = m.dealIds.join(',');
    if (!dealGroupMap.has(key)) dealGroupMap.set(key, []);
    dealGroupMap.get(key)!.push(m);
  });

  dealGroupMap.forEach((msgs, key) => {
    const dealIds = key.split(',');
    const sorted = [...msgs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const primaryDeal = deals.find(d => d.id === dealIds[0]);
    if (!primaryDeal) return;

    const bookrunnerNames = primaryDeal.bookrunners?.map(b => b.name).join(', ') || '';

    alertGroups.push({
      borrower: primaryDeal.issuerName,
      dealIds,
      messages: sorted,
      latestMessage: sorted[0],
      headline: sorted[0].subject,
      bookrunners: bookrunnerNames.length > 30 ? bookrunnerNames.slice(0, 28) + '...' : bookrunnerNames,
      stage: primaryDeal.stage,
    });
  });

  // Sort by latest update
  alertGroups.sort((a, b) => b.latestMessage.updatedAt.getTime() - a.latestMessage.updatedAt.getTime());

  // Filter by stage
  const filtered = filterStage === 'all' ? alertGroups : alertGroups.filter(g => g.stage === filterStage);

  const toggleExpand = (id: string) => {
    setExpandedAlertId(prev => prev === id ? null : id);
  };

  const handleOpenChat = (dealIds: string[]) => {
    setActiveDealId(dealIds[0]);
    setShowChat(true);
  };

  const navigate = useNavigate();

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Master Deal Alerts</h1>
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
          {/* Create New Alert button */}
          {canManageMessages && (
            <div className="flex justify-center mb-4">
              <Button onClick={() => navigate('/ai-draft')} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Create New Alert
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
                    onClick={() => toggleExpand(groupKey)}
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
                    <div className="col-span-2 font-medium text-sm">
                      {group.borrower}
                    </div>
                    <div className="col-span-4 text-sm text-muted-foreground truncate">
                      {group.headline}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground truncate">
                      {group.bookrunners}
                    </div>
                    <div className="col-span-1">
                      <Badge className={`text-[10px] border ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="bg-card/40 border-t border-border px-8 py-3 space-y-3">
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={(e) => { e.stopPropagation(); handleOpenChat(group.dealIds); }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Open Chat
                        </Button>
                        {canManageMessages && group.latestMessage.status === 'draft' && (
                          <Button
                            size="sm"
                            className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendMessage(group.latestMessage.id);
                              toast({ title: 'Alert Sent', description: `Sent to ${group.latestMessage.recipients.length} recipients` });
                            }}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send Latest Draft
                          </Button>
                        )}
                      </div>

                      {/* Message history */}
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Alert History ({group.messages.length} update{group.messages.length !== 1 ? 's' : ''})
                      </div>
                      {group.messages.map(msg => (
                        <div key={msg.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                          <div className="text-timestamp text-xs whitespace-nowrap min-w-[120px]">
                            {format(msg.updatedAt, 'MMM d, hh:mm a')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium mb-0.5">{msg.subject}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{msg.body}</div>
                            {msg.attachments.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">📎 {msg.attachments.length} attachment(s)</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={msg.status === 'sent' ? 'default' : msg.status === 'draft' ? 'secondary' : 'destructive'}
                              className="text-[10px]"
                            >
                              {msg.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{getUserName(msg.senderId)}</span>
                          </div>
                        </div>
                      ))}
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
