import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import type { Deal } from '@/types/bond';
import { Button } from '@/components/ui/button';
import MsgPreview from '@/components/MsgPreview';
import { useLiveMessage, previousMsgText } from '@/hooks/useLiveMessage';
import { buildMsgLines, buildMsgText, changedMsgLines } from '@/lib/msgFormat';
import { buildSubject, eventForStage } from '@/lib/newIssueAlerts';
import { dealBorrowerName } from '@/lib/borrowerName';
import { loadDistribution, loadAlertStatus, type AlertStatus } from '@/lib/distribution';
import { selectRecipients } from '@/lib/newIssueAlerts';
import { bccList } from '@/lib/alertMail';

export default function LiveMsgPanel({ deal, onSend, canSend }: { deal: Deal; onSend: () => void; canSend: boolean }) {
  const live = useLiveMessage(deal);
  const [status, setStatus] = useState<AlertStatus | null>(null);
  const [addresses, setAddresses] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    loadAlertStatus().then(s => { if (active) setStatus(s); });
    loadDistribution().then(d => { if (active) setAddresses(selectRecipients(d).map(r => r.address)); }).catch(() => {});
    return () => { active = false; };
  }, [deal.id]);
  if (live.error) return <p role="alert" className="text-sm text-destructive">Message unavailable: {live.error}</p>;
  if (!live.loaded) return <p role="status" className="text-sm text-muted-foreground">Loading message…</p>;
  if (!live.state?.f) return <p className="text-sm text-muted-foreground">No saved Deal Terms.</p>;
  const borrower = dealBorrowerName({ ...deal, bdtState: live.state });
  const event = eventForStage(live.stage);
  const args = { state: live.state, ws: live.ws, borrower, event, notes: live.notes.terms, legalNotices: live.notes.legal ? [live.notes.legal] : [] };
  return <div className="space-y-2">
    <MsgPreview text={buildMsgText(args)} lines={buildMsgLines(args)} changed={changedMsgLines(args, live.lastSent?.terms_snapshot ?? null, previousMsgText(live.lastSent))}
      subject={buildSubject(live.state, event, '', live.ws?.tranches[0]?.tenor ?? '')} sender={status?.sender ?? { name: '', org: '' }}
      distributionCount={bccList(addresses, status?.syndicateMailbox ?? '').length} updatedAt={live.updatedAt} connected={live.connected} />
    {canSend && <Button variant="outline" size="sm" className="gap-1" onClick={onSend}><Send className="h-4 w-4" />Send update</Button>}
  </div>;
}