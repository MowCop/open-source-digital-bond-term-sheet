import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Message, MessageStatus, DealStage } from '@/types/bond';
import { format } from 'date-fns';
import { Send, RotateCcw, Paperclip, FileText, Eye, MessageSquare } from 'lucide-react';
import SecureChat from '@/components/SecureChat';
import { useToast } from '@/hooks/use-toast';

const statusBadge: Record<MessageStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending_review: { label: 'Pending Review', variant: 'outline' },
  confirmed: { label: 'Confirmed', variant: 'default' },
  sent: { label: 'Sent', variant: 'default' },
  retracted: { label: 'Retracted', variant: 'destructive' },
};

const stageColor: Record<DealStage, string> = {
  Mandate: 'bg-blue-100 text-blue-800',
  Announced: 'bg-blue-100 text-blue-800',
  Launched: 'bg-green-100 text-green-800',
  'Books Open': 'bg-green-100 text-green-800',
  'Books Closed': 'bg-green-100 text-green-800',
  Priced: 'bg-amber-100 text-amber-800',
  Settled: 'bg-amber-100 text-amber-800',
};

export default function MessagesPage() {
  const { messages, deals, users, sendMessage, retractMessage, updateMessage, currentUser } = useApp();
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [filterDeal, setFilterDeal] = useState<string>('all');
  const [editBody, setEditBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const { toast } = useToast();

  const canManageMessages = currentUser.role === 'syndicate_admin' || currentUser.role === 'master_admin';
  const filteredMessages = messages
    .filter(m => filterDeal === 'all' || m.dealIds.includes(filterDeal))
    .filter(m => {
      if (currentUser.role === 'vendor_user') return m.recipients.includes(currentUser.id) || m.senderId === currentUser.id;
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const getDeal = (dealId: string) => deals.find(d => d.id === dealId);

  const getStagePrefix = (dealIds: string[]) => {
    const stages = dealIds.map(id => getDeal(id)?.stage).filter(Boolean);
    if (stages.length === 0) return '';
    const uniqueStages = [...new Set(stages)];
    return `[${uniqueStages.map(s => s!.toUpperCase()).join(' | ')}] `;
  };

  const handleSelectMsg = (msg: Message) => {
    setSelectedMsg(msg);
    setIsEditing(false);
    if (msg.dealIds.length > 0) setActiveDealId(msg.dealIds[0]);
  };

  const handleSend = (msg: Message) => {
    sendMessage(msg.id);
    toast({ title: 'Message Sent', description: `Alert sent to ${msg.recipients.length} recipients` });
    setSelectedMsg({ ...msg, status: 'sent', sentAt: new Date() });
  };

  const handleRetract = (msg: Message) => {
    retractMessage(msg.id);
    toast({ title: 'Message Retracted', description: 'Alert has been retracted from all recipients', variant: 'destructive' });
    setSelectedMsg({ ...msg, status: 'retracted' });
  };

  const handleSaveEdit = () => {
    if (selectedMsg) {
      updateMessage(selectedMsg.id, { body: editBody });
      setSelectedMsg({ ...selectedMsg, body: editBody });
      setIsEditing(false);
      toast({ title: 'Draft Updated' });
    }
  };

  const handleJoinChat = (dealId: string) => {
    setActiveDealId(dealId);
    toast({ title: 'Chat Opened', description: 'Switched to deal thread in Secure Communications' });
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;
  const getDealName = (id: string) => { const d = deals.find(d => d.id === id); return d ? `${d.issuerName} ${d.currency} ${d.tenor}` : id; };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-muted-foreground text-sm">Manage deal alerts and communications</p>
        </div>
        <Select value={filterDeal} onValueChange={setFilterDeal}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Filter by deal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deals</SelectItem>
            {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.issuerName} {d.currency} {d.tenor}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({filteredMessages.length})</TabsTrigger>
              <TabsTrigger value="draft">Drafts ({filteredMessages.filter(m => m.status === 'draft').length})</TabsTrigger>
              <TabsTrigger value="sent">Sent ({filteredMessages.filter(m => m.status === 'sent').length})</TabsTrigger>
              <TabsTrigger value="retracted">Retracted ({filteredMessages.filter(m => m.status === 'retracted').length})</TabsTrigger>
            </TabsList>

            {['all', 'draft', 'sent', 'retracted'].map(tab => (
              <TabsContent key={tab} value={tab}>
                <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-2 space-y-2 max-h-[600px] overflow-auto">
                    {filteredMessages.filter(m => tab === 'all' || m.status === tab).map(msg => (
                      <Card key={msg.id} className={`cursor-pointer hover:shadow-sm transition-shadow ${selectedMsg?.id === msg.id ? 'ring-2 ring-primary' : ''}`} onClick={() => handleSelectMsg(msg)}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-1">
                            <div className="font-medium text-sm truncate flex-1">
                              <span className="font-bold text-xs">{getStagePrefix(msg.dealIds)}</span>
                              {msg.subject}
                            </div>
                            <Badge variant={statusBadge[msg.status].variant} className="ml-2 shrink-0 text-xs">{statusBadge[msg.status].label}</Badge>
                          </div>
                          <div className="mb-1 flex flex-wrap gap-1">
                            {msg.dealIds.map(did => {
                              const deal = getDeal(did);
                              return deal ? (
                                <Badge key={did} className={`text-[10px] px-1.5 py-0 ${stageColor[deal.stage]}`}>
                                  {deal.issuerName} {deal.currency} {deal.tenor} · {deal.stage}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{msg.body}</div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">{getUserName(msg.senderId)}</span>
                            <span className="text-xs text-muted-foreground">{format(msg.createdAt, 'MMM d, HH:mm')}</span>
                          </div>
                          {msg.attachments.length > 0 && (
                            <div className="flex items-center gap-1 mt-1"><Paperclip className="h-3 w-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">{msg.attachments.length} file(s)</span></div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {filteredMessages.filter(m => tab === 'all' || m.status === tab).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No messages</p>
                    )}
                  </div>

                  <div className="col-span-3">
                    {selectedMsg ? (
                      <Card>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">
                                <span className="font-bold">{getStagePrefix(selectedMsg.dealIds)}</span>
                                {selectedMsg.subject}
                              </CardTitle>
                              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                                {selectedMsg.dealIds.map(did => {
                                  const deal = getDeal(did);
                                  return deal ? (
                                    <span key={did} className="flex items-center gap-1">
                                      <span>{deal.issuerName} {deal.currency} {deal.tenor}</span>
                                      <Badge className={`text-[10px] ${stageColor[deal.stage]}`}>{deal.stage}</Badge>
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedMsg.dealIds.length === 1 ? (
                                <Button size="sm" variant="outline" className="text-xs" onClick={() => handleJoinChat(selectedMsg.dealIds[0])}>
                                  <MessageSquare className="h-3 w-3 mr-1" />Join Chat
                                </Button>
                              ) : (
                                <Select onValueChange={handleJoinChat}>
                                  <SelectTrigger className="h-8 w-auto text-xs">
                                    <MessageSquare className="h-3 w-3 mr-1" /><SelectValue placeholder="Join Chat..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedMsg.dealIds.map(did => (
                                      <SelectItem key={did} value={did} className="text-xs">{getDealName(did)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Badge variant={statusBadge[selectedMsg.status].variant}>{statusBadge[selectedMsg.status].label}</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>From: {getUserName(selectedMsg.senderId)}</div>
                            <div>To: {selectedMsg.recipients.map(getUserName).join(', ')}</div>
                            <div>Created: {format(selectedMsg.createdAt, 'MMM d, yyyy HH:mm')}</div>
                            {selectedMsg.sentAt && <div>Sent: {format(selectedMsg.sentAt, 'MMM d, yyyy HH:mm')}</div>}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={6} />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">{selectedMsg.body}</div>
                          )}

                          {selectedMsg.attachments.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Attachments</h4>
                              <div className="space-y-1">
                                {selectedMsg.attachments.map(a => (
                                  <div key={a.id} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span>{a.name}</span>
                                    <span className="text-xs text-muted-foreground">({(a.size / 1024).toFixed(0)} KB)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedMsg.aiSuggestions && (
                            <div className="border rounded-md p-3">
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                AI Suggestions
                                <Badge variant="outline" className="text-xs">{(selectedMsg.aiSuggestions.confidence * 100).toFixed(0)}% confidence</Badge>
                              </h4>
                              <div className="text-sm space-y-1">
                                <div><span className="text-muted-foreground">Headline:</span> {selectedMsg.aiSuggestions.headline}</div>
                                <div><span className="text-muted-foreground">Summary:</span> {selectedMsg.aiSuggestions.dealSummary}</div>
                              </div>
                            </div>
                          )}

                          {canManageMessages && (
                            <div className="flex gap-2 pt-2 border-t">
                              {selectedMsg.status === 'draft' && (
                                <>
                                  <Button size="sm" onClick={() => { setEditBody(selectedMsg.body); setIsEditing(true); }}><Eye className="h-4 w-4 mr-1" />Edit</Button>
                                  <Button size="sm" onClick={() => handleSend(selectedMsg)}><Send className="h-4 w-4 mr-1" />Send</Button>
                                </>
                              )}
                              {selectedMsg.status === 'sent' && (
                                <Button size="sm" variant="destructive" onClick={() => handleRetract(selectedMsg)}><RotateCcw className="h-4 w-4 mr-1" />Retract</Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Select a message to view details</div>
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="col-span-1">
          <SecureChat activeDealId={activeDealId} />
        </div>
      </div>
    </div>
  );
}
