import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ChevronDown, ChevronUp, X, Users } from 'lucide-react';
import { format } from 'date-fns';

const COLLAPSE_KEY = 'bondvdr.aiDraft.chatOpen';
const HEIGHT_KEY = 'bondvdr.aiDraft.chatHeight';
const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 192;

interface Props {
  draftKey: string;
  headline: string;
  scpIds: string[];
  /** Eligible Syndicate users that can be added as chat participants (excludes current user). */
  candidates: { id: string; name: string; organization?: string; email?: string }[];
  /** Add/remove handler for an SCP id. */
  onToggleScp: (id: string) => void;
}

/**
 * Full-width chat strip that sits under the "Create New Issue" title.
 * Chat title is a live mirror of the bulletin headline. The underlying
 * ChatChannel is created lazily on the first message; until then we render
 * an empty-state input row. Participants = creator + selected SCPs.
 */
export default function DraftChatStrip({ draftKey, headline, scpIds, candidates, onToggleScp }: Props) {
  const {
    currentUser, users, chatChannels, chatMessages,
    ensureDraftChannel, renameChatChannel, updateChatChannelParticipants, sendChatMessage,
  } = useApp();

  const [channelId, setChannelId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) !== 'false'; } catch { return true; }
  });
  const [messagesHeight, setMessagesHeight] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(HEIGHT_KEY));
      return v && v >= MIN_HEIGHT ? v : DEFAULT_HEIGHT;
    } catch { return DEFAULT_HEIGHT; }
  });
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [scpQuery, setScpQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const channel = channelId ? chatChannels.find(c => c.id === channelId) ?? null : null;
  const channelMessages = useMemo(
    () => channel ? chatMessages.filter(m => m.channelId === channel.id).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) : [],
    [channel, chatMessages],
  );
  const participantUsers = useMemo(() => {
    const ids = channel?.participantIds ?? Array.from(new Set([currentUser.id, ...scpIds]));
    return ids.map(id => users.find(u => u.id === id)).filter(Boolean) as typeof users;
  }, [channel, scpIds, currentUser.id, users]);

  const displayLabel = (headline || '').trim() || 'New Issue Chat';

  const q = scpQuery.trim().toLowerCase();
  const scpMatches = q
    ? candidates.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.organization || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q),
      ).slice(0, 6)
    : [];

  // Persist collapse state.
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, open ? 'true' : 'false'); } catch { /* ignore */ }
  }, [open]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Ignore drags that originate on buttons/inputs inside the header.
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input')) return;
    if (!open) return;
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: messagesHeight };
    const maxH = Math.max(MIN_HEIGHT, Math.round(window.innerHeight * 0.7));
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = ev.clientY - dragRef.current.startY;
      const next = Math.min(maxH, Math.max(MIN_HEIGHT, dragRef.current.startH + dy));
      setMessagesHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { setMessagesHeight(h => { localStorage.setItem(HEIGHT_KEY, String(h)); return h; }); } catch { /* ignore */ }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [channelMessages.length]);

  // Debounced rename when the headline changes and a channel exists.
  useEffect(() => {
    if (!channelId) return;
    const t = window.setTimeout(() => {
      renameChatChannel(channelId, displayLabel);
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLabel, channelId]);

  // Sync participants when SCP list changes and a channel exists.
  useEffect(() => {
    if (!channelId) return;
    updateChatChannelParticipants(channelId, scpIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scpIds.join('|'), channelId]);

  const canSend = currentUser.role === 'master_admin' || currentUser.role === 'syndicate_admin';

  const handleSend = () => {
    const text = input.trim();
    if (!text || !canSend) return;
    let id = channelId;
    if (!id) {
      const ch = ensureDraftChannel(draftKey, displayLabel, scpIds);
      id = ch.id;
      setChannelId(id);
    }
    sendChatMessage(id, text);
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!canSend) return null;

  return (
    <div className="bg-card border border-border rounded-lg">
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-4 py-2 border-b border-border ${open ? 'cursor-ns-resize select-none' : ''}`}
        onMouseDown={handleHeaderMouseDown}
        title={open ? 'Drag to resize chat' : undefined}
      >
        <div className="text-sm font-semibold truncate" title={displayLabel}>
          {displayLabel}
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">Chat</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {participantUsers.length} participant{participantUsers.length === 1 ? '' : 's'}
          </Badge>
          {channel && (
            <Badge variant="outline" className="text-[10px]">{channelMessages.length} msg{channelMessages.length === 1 ? '' : 's'}</Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setOpen(o => !o)}
            title={open ? 'Collapse' : 'Expand'}
            aria-label={open ? 'Collapse chat' : 'Expand chat'}
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col">
          {/* Participants sub-section (collapsible, manage SCPs) */}
          <div className="border-b border-border/60 bg-muted/20">
            <button
              type="button"
              onClick={() => setParticipantsOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/40"
            >
              <Users className="h-3 w-3" />
              <span className="font-medium">Add participants ({participantUsers.length})</span>
              {participantsOpen
                ? <ChevronUp className="h-3 w-3 ml-auto" />
                : <ChevronDown className="h-3 w-3 ml-auto" />}
            </button>
            {participantsOpen && (
              <div className="px-4 pb-3 pt-1 space-y-2">
                {participantUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {participantUsers.map(u => {
                      const isCreator = u.id === currentUser.id;
                      return (
                        <Badge key={u.id} variant="secondary" className="text-[11px] gap-1 pr-1">
                          {u.name} <span className="text-muted-foreground">· {u.organization}</span>
                          {!isCreator && (
                            <button
                              onClick={() => onToggleScp(u.id)}
                              className="ml-1 hover:text-destructive"
                              aria-label={`Remove ${u.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
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
                          onClick={() => { onToggleScp(u.id); setScpQuery(''); }}
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
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="px-4">
            <div
              ref={scrollRef}
              className="py-2 space-y-2 overflow-y-auto"
              style={{ height: messagesHeight }}
            >
              {channelMessages.length === 0 ? null : (
                channelMessages.map(cm => {
                  const isMe = cm.senderId === currentUser.id;
                  return (
                    <div key={cm.id} className={`flex flex-col text-xs ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="text-[10px] text-muted-foreground mb-0.5">
                        {isMe ? 'You' : cm.senderName} · {format(cm.timestamp, 'HH:mm')}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-md px-2.5 py-1.5 whitespace-pre-wrap break-words ${
                          isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                        }`}
                      >
                        {cm.body}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex items-center gap-2 p-2 border-t border-border">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message the Syndicate Chat Participants…"
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-8" onClick={handleSend} disabled={!input.trim()}>
              <Send className="h-3 w-3 mr-1" />
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}