import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { stripHtml } from '@/lib/htmlText';
import type { Message, ChatMessage, Attachment } from '@/types/bond';
import ExtractDealReviewModal, { type AIExtraction } from './ExtractDealReviewModal';

interface CommonProps {
  conversationLabel: string;
  targetDealIds?: string[];
  className?: string;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
}

interface FromThreadProps extends CommonProps {
  source: 'thread';
  messages: Message[];          // pre-sorted; we sort oldest→newest internally
}

interface FromChannelProps extends CommonProps {
  source: 'channel';
  chatMessages: ChatMessage[];  // oldest→newest expected; we re-sort
  sourceChannelId?: string;
}

type Props = FromThreadProps | FromChannelProps;

function buildThreadTranscript(msgs: Message[]): string {
  return [...msgs]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(m => {
      const body = stripHtml(m.body || '');
      const att = (m.attachments ?? []).map((a: Attachment) => a.name).filter(Boolean).join(', ');
      return [
        `[${m.createdAt.toISOString()}] ${m.subject}`,
        body,
        att ? `Attachments: ${att}` : '',
      ].filter(Boolean).join('\n');
    })
    .join('\n\n---\n\n');
}

function buildChannelTranscript(msgs: ChatMessage[]): string {
  return [...msgs]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map(m => {
      const body = stripHtml(m.body || '');
      const att = (m.attachments ?? []).map(a => a.name).filter(Boolean).join(', ');
      return [
        `[${m.timestamp.toISOString()}] ${m.senderName} (${m.senderType}):`,
        body,
        att ? `Attachments: ${att}` : '',
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

export default function ExtractDealFromChatButton(props: Props) {
  const { conversationLabel, targetDealIds, className, size = 'sm', variant = 'outline' } = props;
  const { deals, currentUser } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [extraction, setExtraction] = useState<AIExtraction | null>(null);
  const [open, setOpen] = useState(false);
  const [popping, setPopping] = useState(false);

  const canRun = currentUser.role === 'master_admin' || currentUser.role === 'syndicate_admin';
  if (!canRun) return null;

  const handleClick = async () => {
    setPopping(true);
    window.setTimeout(() => setPopping(false), 750);
    const text = props.source === 'thread'
      ? buildThreadTranscript(props.messages)
      : buildChannelTranscript(props.chatMessages);

    if (text.trim().length < 20) {
      toast({
        title: 'Not enough content',
        description: 'Need at least one substantive message in the conversation.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const allowedDealIds = new Set((targetDealIds ?? []).filter(Boolean));
      const extractionDeals = allowedDealIds.size > 0
        ? deals.filter(d => allowedDealIds.has(d.id))
        : deals;
      const existingDeals = extractionDeals.map(d => ({
        id: d.id,
        issuerName: d.issuerName,
        currency: d.currency,
        size: d.size,
        tenor: d.tenor,
        stage: d.stage,
        isin: d.isin,
      }));

      const { data, error } = await supabase.functions.invoke('extract-deal-from-chat', {
        body: { text, conversationLabel, existingDeals },
      });

      if (error) {
        const msg = (error as any).context?.body
          ? await (async () => { try { return JSON.parse(await (error as any).context.body.text()); } catch { return null; } })()
          : null;
        toast({
          title: 'Extraction failed',
          description: msg?.message || error.message || 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      if ((data as any)?.error) {
        toast({
          title: 'Extraction failed',
          description: (data as any).message || (data as any).error,
          variant: 'destructive',
        });
        return;
      }

      setExtraction(data as AIExtraction);
      setOpen(true);
    } catch (e) {
      toast({
        title: 'Extraction failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={`btn-champagne ${popping ? 'is-popping' : ''} ${className ?? ''}`}
        onClick={handleClick}
        disabled={loading}
        title="Extract bond deal info from this conversation"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          : <Sparkles className="h-3.5 w-3.5 mr-1" style={{ color: '#f3d98a' }} />}
        AI Extract
      </Button>
      <ExtractDealReviewModal
        open={open}
        onOpenChange={setOpen}
        extraction={extraction}
        conversationLabel={conversationLabel}
        sourceChannelId={props.source === 'channel' ? props.sourceChannelId : undefined}
      />
    </>
  );
}