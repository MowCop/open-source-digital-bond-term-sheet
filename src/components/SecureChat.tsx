import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Paperclip, Link2, ShieldCheck, FileText, X, Bot } from 'lucide-react';
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
}

export default function SecureChat({ activeDealId }: SecureChatProps) {
  const { currentUser, users, chatChannels, chatMessages, messages, deals, sendChatMessage } = useApp();
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [inputText, setInputText] = useState('');
  const [linkingMessageId, setLinkingMessageId] = useState<string | undefined>();
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const myChannels = chatChannels.filter(ch => ch.participantIds.includes(currentUser.id));

  // When activeDealId changes externally, auto-select matching channel
  useEffect(() => {
    if (activeDealId) {
      const dealChannel = myChannels.find(ch => ch.dealId === activeDealId);
      if (dealChannel) {
        setActiveChannel(dealChannel);
      }
    }
  }, [activeDealId]);

  const channelMessages = activeChannel
    ? chatMessages.filter(cm => cm.channelId === activeChannel.id).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    : [];

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;
  const getLinkedMessage = (id: string) => messages.find(m => m.id === id);

  const sentMessages = messages.filter(m => m.status === 'sent');

  // Get deal stage for header badge
  const activeDeal = activeChannel?.dealId ? deals.find(d => d.id === activeChannel.dealId) : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [channelMessages.length, activeChannel]);

  useEffect(() => {
    if (!activeChannel && myChannels.length > 0 && !activeDealId) {
      setActiveChannel(myChannels[0]);
    }
  }, [myChannels, activeChannel, activeDealId]);

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
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Secure Communications</CardTitle>
          <Badge variant="outline" className="text-[10px] ml-auto">End-to-End Encrypted</Badge>
        </div>
        {activeDeal && (
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[10px] ${stageColor[activeDeal.stage]}`}>{activeDeal.stage}</Badge>
            <span className="text-[10px] text-muted-foreground">{activeDeal.borrower} {activeDeal.currency} {activeDeal.tenor}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 overflow-hidden p-3 pt-0">
        {/* Channel selector */}
        <Select
          value={activeChannel?.id || ''}
          onValueChange={id => setActiveChannel(myChannels.find(ch => ch.id === id) || null)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select a conversation" />
          </SelectTrigger>
          <SelectContent>
            {myChannels.map(ch => {
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
                    <div key={cm.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
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
                          <p>{cm.body}</p>
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
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!inputText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            {myChannels.length === 0 ? 'No conversations available for your role' : 'Select a conversation'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
