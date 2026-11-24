import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { MsgLine } from '@/lib/msgFormat';

interface Props {
  text: string; lines: MsgLine[]; changed: Set<number>; subject: string;
  sender: { name: string; org: string }; distributionCount: number;
  updatedAt: string; connected: boolean;
}
export default function MsgPreview({ text, lines, changed, subject, sender, distributionCount, updatedAt, connected }: Props) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { toast.error('Could not copy message text.'); }
  };
  const date = new Date(updatedAt);
  const time = Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(11, 19);
  return <section className="msg-window" aria-label="MSG message preview">
    <header className="msg-header">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">MESSAGE</span>
        <Button variant="ghost" size="sm" className="msg-copy h-7 gap-1" onClick={copy} onBlur={() => setCopied(false)} title="Copy exact message text">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy text'}
        </Button>
      </div>
      <dl className="msg-envelope">
        <dt>From:</dt><dd>{[sender.name, sender.org].filter(Boolean).join(' / ') || '—'}</dd>
        <dt>To:</dt><dd>{distributionCount} distribution address{distributionCount === 1 ? '' : 'es'}</dd>
        <dt>Subject:</dt><dd>{subject}</dd>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-1 mt-2 text-[11px]">
        <span>{Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)} {time} UTC</span>
        <span role="status" className="flex items-center gap-1.5"><span className={connected ? 'msg-pulse' : 'msg-disconnected'} />{connected ? 'Live' : 'Connecting'} · updated {time}</span>
      </div>
    </header>
    <div className="msg-body" tabIndex={0} aria-label="Message text">
      {lines.map((line, i) => {
        const colon = line.key ? line.text.indexOf(' : ') : -1;
        return <div key={i} className={`msg-line${changed.has(i) ? ' msg-changed' : ''}`}>
          <span className="msg-gutter" aria-hidden="true">{changed.has(i) ? 'CHG' : ''}</span>
          <span className="msg-text">{colon >= 0 ? <><span className="msg-label">{line.text.slice(0, colon + 3)}</span>{line.text.slice(colon + 3)}</> : line.text || '\u00a0'}</span>
        </div>;
      })}
    </div>
  </section>;
}