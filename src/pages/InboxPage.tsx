import { useMemo, useRef, useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Paperclip, Link2, ChevronDown, ChevronRight, Search, MessageSquare, FileText, Bot, ShieldCheck, Inbox } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import type { ChatChannel, ChatMessage, Deal, DealStage } from '@/types/bond';

const stageColor: Record<DealStage, string> = {
  Mandate: 'bg-blue-100 text-blue-800',
  Announced: 'bg-blue-100 text-blue-800',
  Launched: 'bg-green-100 text-green-800',
  'Books Open': 'bg-green-100 text-green-800',
  'Books Closed': 'bg-green-100 text-green-800',
  Priced: 'bg-amber-100 text-amber-800',
  Settled: 'bg-amber-100 text-amber-800',
};

function formatTime(ts: Date) {
  if (isToday(ts)) return format(ts, 'HH:mm');
  if (isYesterday(ts)) return 'Yesterday';
  return format(ts, 'd MMM');
}

interface ChannelThreadProps {
  channel: ChatChannel;
  search: string;
  lastSeen: number;
  onSeen: (channelId: string, ts: number) => void;
}

function ChannelThread({ channel, search, lastSeen, onSeen }: ChannelThreadProps) {
  const { currentUser, users, chatMessages, messages, sendChatMessage } = useApp();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const channelMsgs = useMemo(
    () =>
      chatMessages
        .filter(m => m.channelId === channel.id)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [chatMessages, channel.id],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channelMsgs;
    return channelMsgs.filter(m => m.body.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q));
  }, [channelMsgs, search]);

  const linkedFor = (id: string) => messages.find(m => m.id === id);

  // Mark seen when rendered (thread is expanded by parent only when needed)
  useEffect(() => {
    if (channelMsgs.length === 0) return;
    const newest = channelMsgs[channelMsgs.length - 1].timestamp.getTime();
    if (newest > lastSeen) onSeen(channel.id, newest);
  }, [channelMsgs, channel.id, lastSeen, onSeen]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filtered.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendChatMessage(channel.id, text);
    setInput('');
  };

  return (
    <div className="border-t bg-muted/20">
      <div className="px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground border-b">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3" />
          <span className="font-medium">{channel.label}</span>
        </div>
        <span>{channel.participantIds.length} participants</span>
      </div>

      <ScrollArea className="h-72" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              {search ? 'No messages match your search.' : 'No messages yet. Start the conversation.'}
            </p>
          )}
          {filtered.map(cm => {
            const isMe = cm.senderId === currentUser.id;
            const isSystem = cm.senderType === 'system';
            const linked = cm.linkedMessageId ? linkedFor(cm.linkedMessageId) : null;

            if (isSystem) {
              return (
                <div key={cm.id} className="flex justify-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-[11px] text-muted-foreground max-w-[90%]">
                    <Bot className="h-3 w-3 shrink-0" />
                    <span>{cm.body}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={cm.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={`text-[10px] ${cm.senderType === 'bank' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}`}
                  >
                    {cm.senderName
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-[75%] space-y-1">
                  <div className={`rounded-lg px-3 py-2 text-xs ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                    {!isMe && (
                      <div className="font-semibold mb-0.5 text-[10px] opacity-70 flex items-center gap-1">
                        {cm.senderName}
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3">
                          {cm.senderType}
                        </Badge>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{cm.body}</p>
                  </div>
                  {linked && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-accent/50 text-[10px] text-muted-foreground">
                      <Link2 className="h-3 w-3" />
                      <span className="truncate">Linked alert: {linked.subject}</span>
                    </div>
                  )}
                  {cm.attachments.map(a => (
                    <div key={a.id} className="flex items-center gap-1 px-2 py-1 rounded bg-accent/50 text-[10px] text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>{a.name}</span>
                      <span>({(a.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  ))}
                  <div className={`text-[10px] text-muted-foreground ${isMe ? 'text-right' : ''}`}>
                    {format(cm.timestamp, 'd MMM, HH:mm')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-1 p-2 border-t bg-card">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled title="Attach (demo)">
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          className="h-8 text-xs flex-1"
          placeholder="Reply in this thread…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface DealRowProps {
  deal: Deal;
  channels: ChatChannel[];
  search: string;
  expanded: boolean;
  onToggle: () => void;
  lastSeen: Record<string, number>;
  onSeen: (channelId: string, ts: number) => void;
}

function DealRow({ deal, channels, search, expanded, onToggle, lastSeen, onSeen }: DealRowProps) {
  const { chatMessages } = useApp();

  const channelStats = useMemo(() => {
    return channels.map(ch => {
      const msgs = chatMessages.filter(m => m.channelId === ch.id);
      const sorted = [...msgs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const last = sorted[0];
      const seen = lastSeen[ch.id] ?? 0;
      const unread = msgs.filter(m => m.timestamp.getTime() > seen).length;
      return { channel: ch, last, unread, total: msgs.length };
    });
  }, [channels, chatMessages, lastSeen]);

  const totalUnread = channelStats.reduce((n, c) => n + c.unread, 0);
  const newestLast = channelStats
    .map(c => c.last)
    .filter((m): m is ChatMessage => Boolean(m))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-3 flex items-start gap-3 hover:bg-accent/40 transition-colors"
      >
        <div className="mt-0.5 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{deal.issuerName}</span>
            <span className="text-xs text-muted-foreground">
              {deal.currency} {deal.size} · {deal.tenor}
            </span>
            <Badge className={`text-[10px] ${stageColor[deal.stage]}`}>{deal.stage}</Badge>
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {channels.length} {channels.length === 1 ? 'thread' : 'threads'}
            </span>
            {totalUnread > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5 min-w-5 px-1.5">
                {totalUnread}
              </Badge>
            )}
          </div>
          {newestLast && (
            <div className="text-xs text-muted-foreground mt-1 truncate">
              <span className="font-medium">{newestLast.senderName}:</span> {newestLast.body}
              <span className="ml-2 text-[10px]">{formatTime(newestLast.timestamp)}</span>
            </div>
          )}
        </div>
      </button>

      {expanded &&
        channelStats.map(({ channel, unread }) => (
          <div key={channel.id}>
            {channels.length > 1 && (
              <div className="px-4 py-1 text-[10px] text-muted-foreground bg-muted/40 flex items-center gap-2">
                <span className="font-medium">{channel.label}</span>
                {unread > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground text-[9px] h-4 px-1.5">{unread} new</Badge>
                )}
              </div>
            )}
            <ChannelThread
              channel={channel}
              search={search}
              lastSeen={lastSeen[channel.id] ?? 0}
              onSeen={onSeen}
            />
          </div>
        ))}
    </Card>
  );
}

export default function InboxPage() {
  const { currentUser, deals, chatChannels, chatMessages } = useApp();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Session-only last-seen timestamps per channel. Initialized to "now" so existing
  // history is considered already read; only NEW activity creates badges.
  const [lastSeen, setLastSeen] = useState<Record<string, number>>(() => {
    const now = Date.now();
    const init: Record<string, number> = {};
    for (const ch of chatChannels) init[ch.id] = now;
    return init;
  });

  // Make sure newly-arrived channels get an initial baseline (no false unread spike)
  useEffect(() => {
    setLastSeen(prev => {
      const now = Date.now();
      let changed = false;
      const next = { ...prev };
      for (const ch of chatChannels) {
        if (next[ch.id] === undefined) {
          next[ch.id] = now;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [chatChannels]);

  const onSeen = (channelId: string, ts: number) => {
    setLastSeen(prev => (prev[channelId] >= ts ? prev : { ...prev, [channelId]: ts }));
  };

  // Deals visible to me = deals that have at least one channel I'm part of
  const myChannels = useMemo(
    () => chatChannels.filter(ch => ch.participantIds.includes(currentUser.id)),
    [chatChannels, currentUser.id],
  );

  const dealEntries = useMemo(() => {
    const byDeal = new Map<string, ChatChannel[]>();
    const orphan: ChatChannel[] = [];
    for (const ch of myChannels) {
      if (ch.dealId) {
        if (!byDeal.has(ch.dealId)) byDeal.set(ch.dealId, []);
        byDeal.get(ch.dealId)!.push(ch);
      } else {
        orphan.push(ch);
      }
    }
    const entries: { deal: Deal; channels: ChatChannel[] }[] = [];
    for (const [dealId, channels] of byDeal) {
      const deal = deals.find(d => d.id === dealId);
      if (deal) entries.push({ deal, channels });
    }
    // Sort by most-recent activity
    entries.sort((a, b) => {
      const lastOf = (chs: ChatChannel[]) =>
        Math.max(
          0,
          ...chatMessages.filter(m => chs.some(c => c.id === m.channelId)).map(m => m.timestamp.getTime()),
        );
      return lastOf(b.channels) - lastOf(a.channels);
    });
    return { entries, orphan };
  }, [myChannels, deals, chatMessages]);

  const q = search.trim().toLowerCase();
  const matchesSearch = (deal: Deal, channels: ChatChannel[]) => {
    if (!q) return true;
    if (deal.issuerName.toLowerCase().includes(q)) return true;
    if (deal.currency.toLowerCase().includes(q) || deal.tenor.toLowerCase().includes(q)) return true;
    if (channels.some(c => c.label.toLowerCase().includes(q))) return true;
    return chatMessages.some(
      m =>
        channels.some(c => c.id === m.channelId) &&
        (m.body.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q)),
    );
  };

  const visibleEntries = dealEntries.entries.filter(e => matchesSearch(e.deal, e.channels));
  const totalUnread = Object.entries(lastSeen).reduce((n, [chId, seen]) => {
    const myCh = myChannels.find(c => c.id === chId);
    if (!myCh) return n;
    return n + chatMessages.filter(m => m.channelId === chId && m.timestamp.getTime() > seen).length;
  }, 0);

  // Auto-expand the first matching deal when searching
  useEffect(() => {
    if (q && visibleEntries.length > 0) {
      setExpanded(prev => (prev[visibleEntries[0].deal.id] ? prev : { ...prev, [visibleEntries[0].deal.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Deal Chat Box</h1>
          {totalUnread > 0 && (
            <Badge className="bg-destructive text-destructive-foreground">{totalUnread} unread</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {visibleEntries.length} {visibleEntries.length === 1 ? 'deal' : 'deals'}
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search deals, threads, senders, or message text…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {visibleEntries.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            {q ? 'No deals match your search.' : 'No deal threads available for your account.'}
          </Card>
        )}
        {visibleEntries.map(({ deal, channels }) => (
          <DealRow
            key={deal.id}
            deal={deal}
            channels={channels}
            search={search}
            expanded={!!expanded[deal.id]}
            onToggle={() => setExpanded(prev => ({ ...prev, [deal.id]: !prev[deal.id] }))}
            lastSeen={lastSeen}
            onSeen={onSeen}
          />
        ))}

        {dealEntries.orphan.length > 0 && !q && (
          <div className="pt-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              General Conversations
            </h2>
            {dealEntries.orphan.map(ch => {
              const msgs = chatMessages.filter(m => m.channelId === ch.id);
              const seen = lastSeen[ch.id] ?? 0;
              const unread = msgs.filter(m => m.timestamp.getTime() > seen).length;
              const isOpen = !!expanded[`orphan-${ch.id}`];
              return (
                <Card key={ch.id} className="overflow-hidden mb-2">
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [`orphan-${ch.id}`]: !prev[`orphan-${ch.id}`] }))}
                    className="w-full text-left p-3 flex items-center gap-3 hover:bg-accent/40"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium text-sm flex-1 truncate">{ch.label}</span>
                    {unread > 0 && (
                      <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5 min-w-5 px-1.5">
                        {unread}
                      </Badge>
                    )}
                  </button>
                  {isOpen && (
                    <ChannelThread channel={ch} search={search} lastSeen={lastSeen[ch.id] ?? 0} onSeen={onSeen} />
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
