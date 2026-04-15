import { useState } from 'react';
import { Message } from '@/types/bond';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Edit2, RotateCcw, Save, X, Send } from 'lucide-react';

interface AlertHistoryCardProps {
  message: Message;
  senderName: string;
  recipientNames: string;
  canManage: boolean;
  onUpdate: (id: string, updates: Partial<Message>) => void;
  onRetract: (id: string) => void;
  onSend: (id: string) => void;
}

export default function AlertHistoryCard({
  message,
  senderName,
  recipientNames,
  canManage,
  onUpdate,
  onRetract,
  onSend,
}: AlertHistoryCardProps) {
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(message.subject);
  const [editBody, setEditBody] = useState(message.body);

  const handleSave = () => {
    onUpdate(message.id, { subject: editSubject, body: editBody });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditSubject(message.subject);
    setEditBody(message.body);
    setEditing(false);
  };

  const isRetracted = message.status === 'retracted';
  const isSent = message.status === 'sent';
  const isDraft = message.status === 'draft';

  return (
    <div className={`rounded-lg border border-border bg-card/60 p-4 space-y-3 ${isRetracted ? 'opacity-50' : ''}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={editSubject}
              onChange={e => setEditSubject(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <div className="text-sm font-medium">{message.subject}</div>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{senderName}</span>
            <span>To: {recipientNames}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-timestamp text-xs whitespace-nowrap">
            {format(message.updatedAt, 'MMM d, hh:mm a')}
          </span>
          <Badge
            variant={isSent ? 'default' : isDraft ? 'secondary' : 'destructive'}
            className="text-[10px]"
          >
            {message.status}
          </Badge>
        </div>
      </div>

      {/* Body */}
      {editing ? (
        <Textarea
          value={editBody}
          onChange={e => setEditBody(e.target.value)}
          className="min-h-[100px] text-sm bg-background"
        />
      ) : (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{message.body}</div>
      )}

      {/* Attachments */}
      {message.attachments.length > 0 && (
        <div className="text-xs text-muted-foreground">📎 {message.attachments.length} attachment(s)</div>
      )}

      {/* Action buttons */}
      {canManage && !isRetracted && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          {editing ? (
            <>
              <Button size="sm" className="text-xs" onClick={handleSave}>
                <Save className="h-3 w-3 mr-1" />
                Save Changes
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={handleCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditing(true)}>
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              {(isSent || isDraft) && (
                <Button size="sm" variant="destructive" className="text-xs" onClick={() => onRetract(message.id)}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retract
                </Button>
              )}
              {isDraft && (
                <Button size="sm" className="text-xs" onClick={() => onSend(message.id)}>
                  <Send className="h-3 w-3 mr-1" />
                  Send
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
