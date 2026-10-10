import { useEffect, useRef, useState } from 'react';
import { getAiModel } from '@/lib/aiModel';
import AiModelPicker from '@/components/AiModelPicker';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
  /** When provided, clicking the button toggles "armed" state instead of running immediately. */
  onArmToggle?: () => void;
  armed?: boolean;
  /** Increment to trigger a run externally (used with onArmToggle). */
  runSignal?: number;
  /** Render as a square icon-only button. */
  iconOnly?: boolean;
  /** Tooltip label shown on hover. */
  tooltip?: string;
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
  const { conversationLabel, targetDealIds, className, size = 'sm', variant = 'outline', iconOnly = false, tooltip } = props;
  const { deals, currentUser } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [extraction, setExtraction] = useState<AIExtraction | null>(null);
  const [open, setOpen] = useState(false);
  const [popping, setPopping] = useState(false);

  const runRef = useRef<() => void>(() => {});
  const lastRunSignal = useRef(props.runSignal ?? 0);
  useEffect(() => {
    const sig = props.runSignal ?? 0;
    if (sig !== lastRunSignal.current) {
      lastRunSignal.current = sig;
      if (sig > 0) runRef.current();
    }
  }, [props.runSignal]);

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
        body: { text, conversationLabel, existingDeals, model: getAiModel() },
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

  runRef.current = handleClick;

  const button = (
    <Button
      size={iconOnly ? 'icon' : size}
      variant={variant}
      aria-pressed={props.onArmToggle ? !!props.armed : undefined}
      className={`btn-champagne ${iconOnly ? 'toolbar-square-btn-ai' : ''} ${popping ? 'is-popping' : ''} ${props.armed ? 'ring-2 ring-primary brightness-110' : ''} ${className ?? ''}`}
      onClick={props.onArmToggle ? (e) => { e.stopPropagation(); props.onArmToggle!(); } : handleClick}
      disabled={loading}
      title={props.onArmToggle ? 'Choose a source, then run AI DataParse' : 'Parse bond deal info from this conversation'}
    >
      {loading
        ? <Loader2 className={`${iconOnly ? 'h-4 w-4' : 'h-3.5 w-3.5 mr-1'} animate-spin`} />
        : <Sparkles className={`${iconOnly ? 'h-4 w-4' : 'h-3.5 w-3.5 mr-1'}`} style={{ color: '#f3d98a' }} />}
      {!iconOnly && 'AI DataParse'}
    </Button>
  );

  return (
    <>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">{tooltip}</TooltipContent>
        </Tooltip>
      ) : button}
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