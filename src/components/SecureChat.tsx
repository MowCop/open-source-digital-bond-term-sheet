import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LinkifiedText from '@/components/LinkifiedText';
import ExtractDealFromChatButton from '@/components/ExtractDealFromChatButton';
import { Send, Paperclip, Link2, ShieldCheck, FileText, X, Bot, Users, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ChatChannel, DealStage } from '@/types/bond';

const stageColor: Record<DealStage, string> = {
  Mandate: 'bg-blue-100 text-blue-800',
  Announced: 'bg-blue-100 text-blue-800',
  Launched: 'bg-green-100 text-green-800',
  'Books Open': 'bg-green-100 text-green-800',
  'Books Closed': 'bg-green-100 text-green-800',
  Priced: 'bg-amber-100 text-amber-800',
  Settled: 'bg-amber-100 text-amber-800',
};

interface SecureChatProps {
  activeDealId?: string | null;
  headerActions?: ReactNode;
  heightClass?: string;
  readOnly?: boolean;
}

export default function SecureChat({ activeDealId, headerActions, heightClass = 'h-[600px]', readOnly = false }: SecureChatProps) {
  const { currentUser, users, chatChannels, chatMessages, messages, deals, sendChatMessage, createDealChannel } = useApp();
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [inputText, setInputText] = useState('');
  const [linkingMessageId, setLinkingMessageId] = useState<string | undefined>();
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlightChatId, setHighlightChatId] = useState<string | null>(null);
  const [startScpIds, setStartScpIds] = useState<string[]>([]);
  const [startQuery, setStartQuery] = useState('');

  const myChannels = chatChannels.filter(ch => ch.participantIds.includes(currentUser.id));

  // In read-only contextual mode (e.g. Edit Alert split-screen), show the
  // deal's channel(s) regardless of whether the current user is a participant.
  const contextualMode = readOnly && !!activeDealId;
  const dealChannels = activeDealId
    ? chatChannels.filter(ch => ch.dealId === activeDealId)
    : [];
  const myDealChannels = activeDealId
    ? myChannels.filter(ch => ch.dealId === activeDealId)
    : [];
  const availableChannels = activeDealId
    ? (contextualMode ? dealChannels : myDealChannels)
    : myChannels;

  // When activeDealId changes externally, auto-select matching channel
  useEffect(() => {
    if (!activeDealId) return;
    // Strict: whenever a deal is supplied, only show a channel that belongs
    // to THIS deal. If none exists, clear any previously selected channel.
    const dealChannel = availableChannels[0] || null;
    setActiveChannel(prev => (prev?.id === dealChannel?.id ? prev : dealChannel));
  }, [activeDealId, contextualMode, chatChannels]);

  const channelMessages = activeChannel
    ? chatMessages.filter(cm => cm.channelId === activeChannel.id).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    : [];

  // Participants (excluding self, excluding system bots)
  const participants = activeChannel
    ? activeChannel.participantIds
        .filter(id => id !== currentUser.id)
        .map(id => users.find(u => u.id === id))
        .filter((u): u is NonNullable<typeof u> => !!u)
    : [];

  const handleParticipantClick = (userId: string, userName: string) => {
    const lastMsg = [...channelMessages].reverse().find(cm => cm.senderId === userId && cm.senderType !== 'system');
    if (lastMsg) {
      setHighlightChatId(lastMsg.id);
      const el = document.getElementById(`chat-msg-${lastMsg.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightChatId(null), 2000);
    }
    const firstName = userName.split(' ')[0];
    setInputText(prev => (prev.startsWith(`@${firstName} `) ? prev : `@${firstName} ${prev}`));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;
  const getLinkedMessage = (id: string) => messages.find(m => m.id === id);

  const sentMessages = messages.filter(m => m.status === 'sent');

  // Get deal stage for header badge
  const activeDeal = activeDealId
    ? deals.find(d => d.id === activeDealId) || null
    : activeChannel?.dealId ? deals.find(d => d.id === activeChannel.dealId) || null : null;
  const extractionConversationLabel = activeDeal
    ? `${activeDeal.issuerName} ${activeDeal.currency} ${activeDeal.tenor} — Deal Thread`
    : activeChannel?.label || 'Deal Thread';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [channelMessages.length, activeChannel]);

  useEffect(() => {
    if (!activeChannel && myChannels.length > 0 && !activeDealId && !readOnly) {
      setActiveChannel(myChannels[0]);
    }
  }, [myChannels, activeChannel, activeDealId, readOnly]);

  const handleSend = () => {
    if (!activeChannel || !inputText.trim()) return;
    sendChatMessage(activeChannel.id, inputText.trim(), [], linkingMessageId);
    setInputText('');
    setLinkingMessageId(undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMockAttachment = () => {
    if (!activeChannel) return;
    sendChatMessage(activeChannel.id, 'Shared an attachment', [{ id: `ca${Date.now()}`, name: 'Document.pdf', type: 'pdf', size: 64000, url: '#' }]);
    setInputText('');
  };

  return (
    <Card className={`flex flex-col ${heightClass}`}>
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Secure Communications</CardTitle>
          {participants.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {participants.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleParticipantClick(p.id, p.name)}
                  title={`Reply to ${p.name}`}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/40 hover:bg-accent text-accent-foreground hover:underline truncate max-w-[120px]"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <Badge variant="outline" className="text-[10px] ml-auto">Secure Channel</Badge>
          {activeChannel && channelMessages.length > 0 &&
            (!activeDealId || activeChannel.dealId === activeDealId) && (
            <ExtractDealFromChatButton
              source="channel"
              chatMessages={channelMessages}
              conversationLabel={extractionConversationLabel}
              targetDealIds={activeDealId ? [activeDealId] : activeChannel.dealId ? [activeChannel.dealId] : undefined}
            />
          )}
          {headerActions && <div className="flex items-center gap-1">{headerActions}</div>}
        </div>
        {activeDeal && (
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[10px] ${stageColor[activeDeal.stage]}`}>{activeDeal.stage}</Badge>
            <span className="text-[10px] text-muted-foreground">{activeDeal.issuerName} {activeDeal.currency} {activeDeal.tenor}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 overflow-hidden p-3 pt-0">
        {/* Channel selector — hide when only one channel is available in contextual mode */}
        {!(activeDealId && availableChannels.length <= 1) && (
        <Select
          value={activeChannel?.id || ''}
          onValueChange={id => setActiveChannel(availableChannels.find(ch => ch.id === id) || null)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select a conversation" />
          </SelectTrigger>
          <SelectContent>
            {availableChannels.map(ch => {
              const deal = ch.dealId ? deals.find(d => d.id === ch.dealId) : null;
              return (
                <SelectItem key={ch.id} value={ch.id} className="text-xs">
                  {deal && <span className={`inline-block mr-1 px-1 rounded text-[9px] ${stageColor[deal.stage]}`}>{deal.stage}</span>}
                  {ch.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        )}

        {activeChannel ? (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
              <div className="space-y-3 py-2">
                {channelMessages.map(cm => {
                  const isMe = cm.senderId === currentUser.id;
                  const isSystem = cm.senderType === 'system';
                  const linked = cm.linkedMessageId ? getLinkedMessage(cm.linkedMessageId) : null;

                  if (isSystem) {
                    return (
                      <div key={cm.id} className="flex justify-center">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border text-[11px] text-muted-foreground max-w-[90%]">
                          <Bot className="h-3 w-3 shrink-0" />
                          <span>{cm.body}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={cm.id}
                      id={`chat-msg-${cm.id}`}
                      className={`flex gap-2 rounded-md transition-colors ${isMe ? 'flex-row-reverse' : ''} ${highlightChatId === cm.id ? 'ring-2 ring-primary/60 bg-primary/5' : ''}`}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className={`text-[10px] ${cm.senderType === 'bank' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}`}>{cm.senderName.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[75%] space-y-1`}>
                        <div className={`rounded-lg px-3 py-2 text-xs ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {!isMe && (
                            <div className="font-semibold mb-0.5 text-[10px] opacity-70 flex items-center gap-1">
                              {cm.senderName}
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3">{cm.senderType}</Badge>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap"><LinkifiedText text={cm.body} /></p>
                        </div>
                        {linked && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded bg-accent/50 text-[10px] text-muted-foreground">
                            <Link2 className="h-3 w-3" />
                            <span className="truncate">Linked: {linked.subject}</span>
                          </div>
                        )}
                        {cm.attachments.length > 0 && cm.attachments.map(a => (
                          <div key={a.id} className="flex items-center gap-1 px-2 py-1 rounded bg-accent/50 text-[10px] text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            <span>{a.name}</span>
                            <span>({(a.size / 1024).toFixed(0)} KB)</span>
                          </div>
                        ))}
                        <div className={`text-[10px] text-muted-foreground ${isMe ? 'text-right' : ''}`}>
                          {format(cm.timestamp, 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {channelMessages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No messages yet. Start the conversation.</p>
                )}
              </div>
            </ScrollArea>

            {/* Linked message indicator */}
            {linkingMessageId && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-accent text-xs text-muted-foreground">
                <Link2 className="h-3 w-3" />
                <span className="truncate flex-1">Linking: {getLinkedMessage(linkingMessageId)?.subject || linkingMessageId}</span>
                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setLinkingMessageId(undefined)}><X className="h-3 w-3" /></Button>
              </div>
            )}

            {/* Link picker */}
            {showLinkPicker && (
              <div className="border rounded p-2 space-y-1 max-h-28 overflow-auto bg-card">
                <div className="text-[10px] font-medium text-muted-foreground mb-1">Link a deal message:</div>
                {sentMessages.map(m => (
                  <button key={m.id} className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent truncate" onClick={() => { setLinkingMessageId(m.id); setShowLinkPicker(false); }}>
                    {m.subject}
                  </button>
                ))}
                {sentMessages.length === 0 && <p className="text-[10px] text-muted-foreground">No sent messages to link</p>}
              </div>
            )}

            {/* Input bar */}
            {!readOnly && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Attach file" onClick={handleMockAttachment}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Link deal message" onClick={() => setShowLinkPicker(!showLinkPicker)}>
                <Link2 className="h-4 w-4" />
              </Button>
              <Input
                className="h-8 text-xs flex-1"
                placeholder="Type a secure message..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                ref={inputRef}
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!inputText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            )}
          </>
        ) : (
          activeDealId && (currentUser.role === 'master_admin' || currentUser.role === 'syndicate_admin') ? (
            (() => {
              const deal = deals.find(d => d.id === activeDealId);
              const defaultLabel = deal
                ? `${deal.issuerName} ${deal.currency} ${deal.tenor} — Deal Thread`
                : 'Deal Chat';
              const candidates = users.filter(u =>
                u.id !== currentUser.id &&
                (u.role === 'syndicate_admin' || u.role === 'syndicate_readonly' || u.role === 'master_admin'),
              );
              const q = startQuery.trim().toLowerCase();
              const matches = q
                ? candidates.filter(u =>
                    u.name.toLowerCase().includes(q) ||
                    (u.organization || '').toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q),
                  ).slice(0, 6)
                : [];
              const selected = startScpIds
                .map(id => users.find(u => u.id === id))
                .filter((u): u is NonNullable<typeof u> => !!u);
              const toggle = (id: string) =>
                setStartScpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
              const handleStart = () => {
                const ch = createDealChannel(activeDealId, defaultLabel, startScpIds);
                setActiveChannel(ch);
                setStartScpIds([]);
                setStartQuery('');
              };
              return (
                <div className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto">
                  <div className="text-xs text-muted-foreground">
                    No chat thread for this deal yet. Start one and invite participants.
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> Participants ({selected.length + 1})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[11px]">
                        {currentUser.name} <span className="text-muted-foreground">· you</span>
                      </Badge>
                      {selected.map(u => (
                        <Badge key={u.id} variant="secondary" className="text-[11px] gap-1 pr-1">
                          {u.name} <span className="text-muted-foreground">· {u.organization}</span>
                          <button
                            onClick={() => toggle(u.id)}
                            className="ml-1 hover:text-destructive"
                            aria-label={`Remove ${u.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      value={startQuery}
                      onChange={e => setStartQuery(e.target.value)}
                      placeholder="Add by name, bank, or email…"
                      className="h-8 text-xs"
                    />
                    {q && matches.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                        {matches.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { toggle(u.id); setStartQuery(''); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/20 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium">{u.name}</div>
                              <div className="text-muted-foreground">{u.organization} · {u.email}</div>
                            </div>
                            {startScpIds.includes(u.id) && <Badge variant="secondary" className="text-[10px]">added</Badge>}
                          </button>
                        ))}
                      </div>
                    )}
                    {q && matches.length === 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-md shadow-md px-3 py-2 text-xs text-muted-foreground">
                        No matching user.
                      </div>
                    )}
                  </div>
                  <Button size="sm" onClick={handleStart} className="self-start">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Start chat
                  </Button>
                </div>
              );
            })()
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              {contextualMode
                ? 'No chat thread for this deal yet'
                : myChannels.length === 0
                  ? 'No conversations available for your role'
                  : 'Select a conversation'}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
