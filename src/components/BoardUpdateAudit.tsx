import { useEffect, useRef, useState } from 'react';
import type { Attachment } from '@/types/bond';
import { auditBoardUpdate, type BoardAuditResult } from '@/lib/boardUpdateAudit';
import { Button } from '@/components/ui/button';
import AiModelPicker from '@/components/AiModelPicker';
import { ShieldCheck, RefreshCw } from 'lucide-react';
export default function BoardUpdateAudit({ text, attachments }: { text: string; attachments: Attachment[] }) {
  const [result, setResult] = useState<BoardAuditResult | null>(null);
  const [error, setError] = useState(''), [step, setStep] = useState('');
  const [running, setRunning] = useState(false);
  const version = useRef(0);
  const signature = JSON.stringify([text, attachments]);
  useEffect(() => {
    version.current += 1;
    setResult(null); setError(''); setRunning(false); setStep('');
    return () => { version.current += 1; };
  }, [signature]);
  async function run() {
    const id = ++version.current;
    setRunning(true); setError(''); setResult(null);
    try {
      const next = await auditBoardUpdate(text, attachments, s => { if (version.current === id) setStep(s); });
      if (version.current === id) setResult(next);
    } catch (e) { if (version.current === id) setError(e instanceof Error ? e.message : 'Update check failed.'); }
    finally { if (version.current === id) { setRunning(false); setStep(''); } }
  }
  return <section className="border-b border-border pb-3 mb-3 space-y-3 text-xs">
    <h3 className="font-semibold text-foreground">Update & attachment audit</h3>
    <div className="flex items-center gap-2 flex-wrap">
      <AiModelPicker compact />
      <Button size="sm" variant="outline" disabled={running} onClick={run}>
        {running ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
        {running ? 'Checking…' : 'Check update'}
      </Button>
    </div>
    {step && <p role="status" className="text-muted-foreground">{step}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {result && <div className="space-y-2" role="status">
      <p className="font-medium">{result.findings.length + result.failed.length} AI warnings · {result.read.length}/{attachments.length} attachments read</p>
      {result.failed.map((name, i) => <p key={i} className="text-destructive">Warning: {name} could not be read; its contents were not verified.</p>)}
      {!attachments.length && <p className="text-muted-foreground">Message checked; no attachments on this update.</p>}
      {!result.findings.length && !result.failed.length && <p>No discrepancies found in the reviewed content.</p>}
      {result.read.length > 0 && <p className="text-muted-foreground">Reviewed excerpts: {result.read.join(', ')}</p>}
      {result.findings.map((f, i) => <div key={i} className="border-l-2 border-primary pl-2 space-y-1">
        <p className="font-semibold">AI warning: {f.title}</p><p>{f.detail}</p>
        {f.docQuote && <blockquote className="text-muted-foreground">“{f.docQuote}”</blockquote>}
      </div>)}
    </div>}
  </section>;
}
