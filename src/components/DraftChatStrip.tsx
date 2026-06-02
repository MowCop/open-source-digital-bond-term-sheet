import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const COLLAPSE_KEY = 'bondvdr.aiDraft.chatOpen';

interface Props {
  draftKey: string;
  headline: string;
  scpIds: string[];
}

/**
 * Full-width chat strip that sits under the "Create New Issue" title.
 * Chat title is a live mirror of the bulletin headline. The underlying
 * ChatChannel is created lazily on the first message; until then we render
 * an empty-state input row. Participants = creator + selected SCPs.
 */
export default function DraftChatStrip({ draftKey, headline, scpIds }: Props) {
  const {
    currentUser, users, chatChannels, chatMessages,
    ensureDraftChannel, renameChatChannel, updateChatChannelParticipants, sendChatMessage,
  } = useApp();

  const [channelId, setChannelId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) !== 'false'; } catch { return true; }
  });
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

  const displayLabel = (headline || '').trim() || 'Untitled New Issue';

  // Persist collapse state.
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, open ? 'true' : 'false'); } catch { /* ignore */ }
  }, [open]);

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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <MessageSquare className="h-4 w-4 text-accent shrink-0" />
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
          {/* Participant chips */}
          {participantUsers.length > 0 && (
            <div className="flex flex-wrap gap-1 px-4 py-1.5 border-b border-border/60 bg-muted/20">
              {participantUsers.map(u => (
                <span key={u.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/30 text-accent-foreground">
                  {u.name}
                  <span className="text-muted-foreground"> · {u.organization}</span>
                </span>
              ))}
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="px-4">
            <div ref={scrollRef} className="max-h-48 py-2 space-y-2 overflow-y-auto">
              {channelMessages.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-2">
                  Start the conversation — the chat will be created with this draft and the title will mirror the headline.
                </div>
              ) : (
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