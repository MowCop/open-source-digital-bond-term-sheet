import { useEffect, useMemo, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Send, RotateCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { buildXML } from '@/lib/termsheet/bdt-xml.js';
import type { BdtState } from '@/lib/bdt-bridge';
import type { Deal } from '@/types/bond';
import { loadDistribution } from '@/lib/distribution';
import { ALERT_EVENTS, buildSendRequest, buildSubject, eventForStage, renderBulletin, selectRecipients, termsDiff, termsHash, type AlertEvent, type DistributionRow } from '@/lib/newIssueAlerts';

interface SendRow { id: string; event: string; subject: string; created_at: string; sender_name: string; release_version: number | null; bdt_hash: string; terms_snapshot: BdtState; alert_send_recipients: { id: string; vendor_name: string; address: string; status: string; error: string | null; attempts: number }[] }

const BCC_KEY = 'dts.alerts.bcc';
async function readError(error: unknown) { return error instanceof FunctionsHttpError ? await error.context.text() : error instanceof Error ? error.message : String(error); }

export default function SendUpdateDialog({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const saved = (deal.bdtState ?? null) as BdtState | null;
  const [event, setEvent] = useState<AlertEvent>(eventForStage(deal.stage));
  const [detail, setDetail] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectEdited, setSubjectEdited] = useState(false);
  const [intro, setIntro] = useState(''); const [notes, setNotes] = useState(''); const [legal, setLegal] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [bcc, setBcc] = useState(() => window.localStorage.getItem(BCC_KEY) ?? '');
  const [dist, setDist] = useState<DistributionRow[]>([]);
  const [sends, setSends] = useState<SendRow[]>([]);
  const [release, setRelease] = useState<{ id: string; version: number } | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadLog = async () => {
    const { data } = await supabase.from('alert_sends').select('id,event,subject,created_at,sender_name,release_version,bdt_hash,terms_snapshot,alert_send_recipients(id,vendor_name,address,status,error,attempts)').eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(20);
    setSends((data ?? []) as unknown as SendRow[]);
  };
  useEffect(() => {
    loadDistribution().then(setDist).catch(() => setDist([]));
    loadLog();
    supabase.from('deal_bulletin_notes').select('intro,notes').eq('deal_id', deal.id).maybeSingle().then(({ data }) => {
      if (data) { setIntro(data.intro); const [n, l = ''] = data.notes.split('\n<<LEGAL>>\n'); setNotes(n); setLegal(l); }
      setNotesLoaded(true);
    });
  }, [deal.id]);

  // Latest saved release whose terms match the deal's saved terms.
  const hash = useMemo(() => saved ? termsHash(saved) : '', [saved]);
  useEffect(() => {
    if (!saved) { setRelease(null); return; }
    supabase.from('deal_term_sheet_releases').select('id,version,bdt_state_snapshot').eq('deal_id', deal.id).order('version', { ascending: false }).limit(5)
      .then(({ data }) => { const r = (data ?? []).find(x => termsHash(x.bdt_state_snapshot) === hash); setRelease(r ? { id: r.id, version: r.version } : null); });
  }, [deal.id, hash]);

  // Live re-render: subject and terms follow saved terms/stage; user text is never touched.
  const auto = saved ? buildSubject(saved, event, detail, deal.tenor) : '';
  useEffect(() => { if (!subjectEdited) setSubject(auto); }, [auto, subjectEdited]);
  useEffect(() => { setApproved(false); }, [hash, event, subject, intro, notes, legal, bcc]);
  const legalNotices = legal.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  const body = renderBulletin({ state: saved, intro, notes, legalNotices });

  const recipients = selectRecipients(dist);
  const lastSent = sends.find(s => s.alert_send_recipients.some(r => r.status === 'sent'));
  const diff = lastSent && saved ? termsDiff(lastSent.terms_snapshot, saved) : [];

  const saveNotes = async () => {
    const { error } = await supabase.from('deal_bulletin_notes').upsert({ deal_id: deal.id, intro, notes: legal ? `${notes}\n<<LEGAL>>\n${legal}` : notes, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message); else toast.success('Bulletin notes saved');
  };

  const send = async () => {
    if (!saved) return;
    let payload;
    try { payload = buildSendRequest({ approved, dealId: deal.id, event, subject, bodyHtml: body, releaseId: release?.id ?? null, state: saved, xml: buildXML(saved), bcc }); }
    catch (e) { toast.error((e as Error).message); return; }
    setBusy(true);
    await saveNotes();
    if (bcc.trim()) window.localStorage.setItem(BCC_KEY, bcc.trim()); else window.localStorage.removeItem(BCC_KEY);
    const { data, error } = await supabase.functions.invoke('send-deal-alert', { body: payload });
    setBusy(false); setApproved(false);
    if (error) { toast.error(`Send failed: ${await readError(error)}`); return; }
    const failed = (data.results as { ok: boolean }[]).filter(r => !r.ok).length;
    if (failed) toast.warning(`${failed} of ${data.results.length} deliveries failed — retry below.`); else toast.success(`Sent to ${data.results.length} recipient${data.results.length === 1 ? '' : 's'}`);
    loadLog();
  };

  const retry = async (recipientId: string) => {
    const { data, error } = await supabase.functions.invoke('send-deal-alert', { body: { action: 'retry', approved: true, recipientId } });
    if (error || !data?.ok) toast.error(`Retry failed: ${error ? await readError(error) : data?.error}`); else toast.success('Delivered');
    loadLog();
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send update · {deal.issuerName}</DialogTitle>
          <DialogDescription>Email a new-issue alert built from the saved term sheet. Nothing is sent until you preview and approve.</DialogDescription>
        </DialogHeader>

        {!saved ? <p className="text-sm text-destructive">Save the Digital Term Sheet before sending an update.</p> : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="alert-event">Lifecycle event</Label>
                <select id="alert-event" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={event} onChange={e => setEvent(e.target.value as AlertEvent)}>
                  {ALERT_EVENTS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="alert-detail">Subject detail (optional)</Label><Input id="alert-detail" placeholder="T+200bp area" value={detail} maxLength={120} onChange={e => setDetail(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="alert-subject">Subject</Label>
              <Input id="alert-subject" value={subject} maxLength={300} onChange={e => { setSubject(e.target.value); setSubjectEdited(true); }} />
              {subjectEdited && <button type="button" className="text-xs text-primary underline" onClick={() => setSubjectEdited(false)}>Reset to saved terms</button>}
            </div>

            {lastSent && (diff.length ? (
              <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-xs space-y-1" role="status">
                <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Terms changed since last send ({new Date(lastSent.created_at).toLocaleString()})</div>
                <table className="w-full"><tbody>{diff.map(d => <tr key={d.key}><th className="text-left pr-2 font-medium align-top">{d.label}</th><td className="line-through text-muted-foreground pr-2 align-top">{d.before || '—'}</td><td className="align-top">{d.after || '—'}</td></tr>)}</tbody></table>
              </div>
            ) : <p className="text-xs text-muted-foreground">No term changes since the last send.</p>)}

            <div className="space-y-1.5"><Label htmlFor="alert-intro">Your intro (kept when terms change)</Label><Textarea id="alert-intro" rows={3} value={intro} disabled={!notesLoaded} onChange={e => setIntro(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="alert-notes">Your notes below the terms</Label><Textarea id="alert-notes" rows={2} value={notes} disabled={!notesLoaded} onChange={e => setNotes(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="alert-legal">Legal notices (pasted verbatim, never AI-written)</Label><Textarea id="alert-legal" rows={2} value={legal} disabled={!notesLoaded} onChange={e => setLegal(e.target.value)} /></div>
            <Button type="button" size="sm" variant="outline" onClick={saveNotes}>Save notes</Button>

            <div className="space-y-1.5">
              <Label>Preview</Label>
              <div className="rounded-md border bg-card p-3 text-sm prose prose-sm max-w-none dark:prose-invert [&_th]:text-left [&_th]:pr-3" dangerouslySetInnerHTML={{ __html: body }} />
              <p className="text-xs text-muted-foreground">Attachment: {deal.id}-v{release?.version ?? '?'}.xml (BDT 2.0, saved snapshot)</p>
            </div>

            <div className="space-y-1.5">
              <Label>Recipients ({recipients.length})</Label>
              {recipients.length ? <div className="flex flex-wrap gap-1">{recipients.map(r => <Badge key={r.address} variant="outline" className="font-normal">{r.vendorName}: {r.address}</Badge>)}</div>
                : <p className="text-xs text-destructive">No enabled vendor has an address. Add one in Bond Console → connector Edit entry.</p>}
              <Label htmlFor="alert-bcc" className="text-xs">BCC syndicate mailbox (optional)</Label>
              <Input id="alert-bcc" type="email" placeholder="syndicate@yourbank.com" value={bcc} onChange={e => setBcc(e.target.value)} />
            </div>

            {!release && <p className="text-xs text-destructive">The saved terms have no matching saved version yet. Save the term sheet again.</p>}
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={approved} onCheckedChange={v => setApproved(v === true)} aria-label="I have reviewed this alert and approve sending it" />
              <span>I have reviewed this alert and approve sending it to {recipients.length + (bcc.trim() ? 1 : 0)} recipient(s).</span></label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={send} disabled={!approved || busy || !saved || !release || !recipients.length} className="gap-1"><Send className="h-4 w-4" />{busy ? 'Sending…' : 'Approve and send'}</Button>
        </DialogFooter>

        <section className="space-y-2 border-t pt-3" aria-label="Send history">
          <h3 className="text-sm font-semibold">Send history</h3>
          {sends.length === 0 ? <p className="text-xs text-muted-foreground">No alerts sent for this deal yet.</p> : sends.map(s => (
            <div key={s.id} className="rounded-md border p-2 text-xs space-y-1">
              <div className="flex flex-wrap gap-2"><span className="font-medium">{s.subject}</span><Badge variant="secondary" className="text-[10px]">{ALERT_EVENTS.find(e => e.id === s.event)?.label ?? s.event}</Badge></div>
              <div className="text-muted-foreground">{new Date(s.created_at).toLocaleString()} · {s.sender_name} · terms v{s.release_version} ({s.bdt_hash.slice(0, 8)})</div>
              <ul>{s.alert_send_recipients.map(r => (
                <li key={r.id} className="flex items-center gap-2">
                  <Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'outline'} className="text-[10px]">{r.status}</Badge>
                  <span>{r.vendor_name}: {r.address}</span>
                  {r.status === 'failed' && <><span className="text-destructive truncate max-w-[16rem]" title={r.error ?? ''}>{r.error}</span><Button size="sm" variant="outline" className="h-6 gap-1 text-[11px]" onClick={() => retry(r.id)}><RotateCw className="h-3 w-3" /> Retry</Button></>}
                </li>
              ))}</ul>
            </div>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
