import { useEffect, useMemo, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Send, RotateCw, AlertTriangle, Sparkles } from 'lucide-react';
import { useAiModel } from '@/lib/aiModel';
import { dealBorrowerName } from '@/lib/borrowerName';
import type { DealWorkspace } from '@/lib/dealWorkspace';
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
import { loadDistribution, loadAlertStatus, type AlertStatus } from '@/lib/distribution';
import { buildFromHeader, bccList, canSend, chunkRecipients, providerStatus } from '@/lib/alertMail';
import { ALERT_EVENTS, buildSendRequest, buildSubject, eventForStage, renderBulletin, dealTermsText, packNotes, unpackNotes, selectRecipients, termsDiff, termsHash, type AlertEvent, type DistributionRow } from '@/lib/newIssueAlerts';

interface SendRow { id: string; event: string; subject: string; created_at: string; sender_name: string; sender_email: string | null; sender_org: string | null; provider: string; release_version: number | null; bdt_hash: string; terms_snapshot: BdtState; alert_send_chunks: { id: string; chunk_index: number; to_address: string; bcc_addresses: string[]; status: string; error: string | null; attempts: number }[] }
async function readError(error: unknown) { return error instanceof FunctionsHttpError ? await error.context.text() : error instanceof Error ? error.message : String(error); }

export default function SendUpdateDialog({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const saved = (deal.bdtState ?? null) as BdtState | null;
  const [event, setEvent] = useState<AlertEvent>(eventForStage(deal.stage));
  const [detail, setDetail] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectEdited, setSubjectEdited] = useState(false);
  const [notes, setNotes] = useState(''); const [notesHash, setNotesHash] = useState(''); const [ws, setWs] = useState<DealWorkspace | null>(null); const [checked, setChecked] = useState(false); const [polishing, setPolishing] = useState(false); const [aiModel] = useAiModel(); const [legal, setLegal] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [status, setStatus] = useState<AlertStatus | null>(null);
  const [showBcc, setShowBcc] = useState(false);
  const [dist, setDist] = useState<DistributionRow[]>([]);
  const [sends, setSends] = useState<SendRow[]>([]);
  const [release, setRelease] = useState<{ id: string; version: number } | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadLog = async () => {
    const { data } = await supabase.from('alert_sends').select('id,event,subject,created_at,sender_name,sender_email,sender_org,provider,release_version,bdt_hash,terms_snapshot,alert_send_chunks(id,chunk_index,to_address,bcc_addresses,status,error,attempts)').eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(20);
    setSends((data ?? []) as unknown as SendRow[]);
  };
  useEffect(() => {
    loadDistribution().then(setDist).catch(() => setDist([]));
    loadAlertStatus().then(setStatus);
    loadLog();
    Promise.all([
      supabase.from('deal_bulletin_notes').select('intro,notes').eq('deal_id', deal.id).maybeSingle(),
      supabase.from('deals').select('deal_workspace').eq('id', deal.id).maybeSingle(),
    ]).then(([{ data }, { data: d }]) => {
      const w = d?.deal_workspace as unknown as DealWorkspace | null;
      const wsv = w?.version === 1 ? w : null; setWs(wsv);
      const u = data ? unpackNotes(data.notes, data.intro) : null;
      if (u?.terms) { setNotes(u.terms); setNotesHash(u.hash); setLegal(u.legal); }
      else { setNotes(dealTermsText(saved, wsv, dealBorrowerName(deal))); setNotesHash(saved ? termsHash(saved) : ''); if (u) setLegal(u.legal); }
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
  useEffect(() => { setApproved(false); }, [hash, event, subject, notes, legal]);
  const stale = notesLoaded && !!notes.trim() && notesHash !== hash && !checked;
  const regenerate = () => { setNotes(dealTermsText(saved, ws, dealBorrowerName(deal))); setNotesHash(hash); setChecked(false); };
  const polish = async () => {
    setPolishing(true);
    const { data, error } = await supabase.functions.invoke('generate-bulletin-from-deal', { body: { dealId: deal.id, model: aiModel, docs: [], editedBulletin: notes } });
    setPolishing(false);
    if (error) { toast.error(`AI polish failed: ${await readError(error)}`); return; }
    const html = String((data as { body?: string })?.body ?? '').split('<h3>Legal Notices</h3>')[0];
    const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h\d|li|tr)>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) { toast.error('AI returned no text.'); return; }
    if (window.confirm('Replace the Terms text with the AI-polished version?\n\n' + text.slice(0, 1500))) setNotes(text);
  };
  const legalNotices = legal.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  const body = renderBulletin({ state: saved, notes, legalNotices });

  const recipients = selectRecipients(dist);
  const adminEmail = status?.sender.email ?? '';
  const bcc = bccList(recipients.map(r => r.address), status?.syndicateMailbox ?? '');
  const chunks = adminEmail ? chunkRecipients(adminEmail, bcc) : [];
  const pStatus = status ? providerStatus(status.provider, { resendVerified: status.resendVerified, graphConnected: status.graphConnected }) : null;
  const gate = status && pStatus ? canSend(status.provider, pStatus, status.sender.name) : { ok: false, message: 'Loading sender settings…' };
  const blocker = !status ? 'Could not load sender settings.' : !status.syndicateMailbox ? 'Set your organisation’s syndicate mailbox in Bond Console → Recipients.' : !gate.ok ? gate.message : '';
  const lastSent = sends.find(s => s.alert_send_chunks.some(r => r.status === 'sent'));
  const diff = lastSent && saved ? termsDiff(lastSent.terms_snapshot, saved) : [];

  const saveNotes = async () => {
    const { error } = await supabase.from('deal_bulletin_notes').upsert({ deal_id: deal.id, intro: '', notes: packNotes(notes, checked ? hash : notesHash, legal), updated_at: new Date().toISOString() });
    if (error) toast.error(error.message); else toast.success('Bulletin notes saved');
  };

  const send = async () => {
    if (!saved) return;
    let payload;
    try { payload = buildSendRequest({ approved, dealId: deal.id, event, subject, bodyHtml: body, releaseId: release?.id ?? null, state: saved, xml: buildXML(saved) }); }
    catch (e) { toast.error((e as Error).message); return; }
    setBusy(true);
    await saveNotes();
    const { data, error } = await supabase.functions.invoke('send-deal-alert', { body: payload });
    setBusy(false); setApproved(false);
    if (error) { toast.error(`Send failed: ${await readError(error)}`); return; }
    const failed = (data.results as { ok: boolean }[]).filter(r => !r.ok).length;
    if (failed) toast.warning(`${failed} of ${data.results.length} emails failed — retry below.`); else toast.success(`Sent ${data.results.length} email${data.results.length === 1 ? '' : 's'}`);
    loadLog();
  };

  const retry = async (chunkId: string) => {
    const { data, error } = await supabase.functions.invoke('send-deal-alert', { body: { action: 'retry', approved: true, chunkId } });
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

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2"><Label htmlFor="alert-notes">Terms</Label>
                <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 gap-1" onClick={regenerate} disabled={!notesLoaded}><RotateCw className="h-3.5 w-3.5" />Regenerate from terms</Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 gap-1" onClick={polish} disabled={!notesLoaded || polishing || !notes.trim()}><Sparkles className="h-3.5 w-3.5" />{polishing ? 'Polishing…' : 'Polish with AI'}</Button></div>
              <Textarea id="alert-notes" rows={8} value={notes} disabled={!notesLoaded} onChange={e => setNotes(e.target.value)} />
              {stale && <div className="rounded-md border border-warning/50 bg-warning/10 p-2 text-xs space-y-1" role="alert"><div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Terms text may be out of date — the saved term sheet changed.</div>
                <label className="flex items-center gap-2"><Checkbox checked={checked} onCheckedChange={v => setChecked(v === true)} />Text checked against current terms</label></div>}
            </div>
            <div className="space-y-1.5"><Label htmlFor="alert-legal">Legal notices (pasted verbatim, never AI-written)</Label><Textarea id="alert-legal" rows={2} value={legal} disabled={!notesLoaded} onChange={e => setLegal(e.target.value)} /></div>
            <Button type="button" size="sm" variant="outline" onClick={saveNotes}>Save notes</Button>

            <div className="space-y-1.5">
              <Label>Preview</Label>
              <div className="rounded-md border bg-card p-3 text-sm prose prose-sm max-w-none dark:prose-invert [&_th]:text-left [&_th]:pr-3" dangerouslySetInnerHTML={{ __html: body }} />
              <p className="text-xs text-muted-foreground">Attachment: {deal.id}-v{release?.version ?? '?'}.xml (BDT 2.0, saved snapshot)</p>
            </div>

            <div className="space-y-1.5 rounded-md border p-3 text-xs" aria-label="Email envelope">
              <div><span className="font-medium">From:</span> {status ? (status.provider === 'resend' ? buildFromHeader(status.sender.name, status.sender.org) : `${status.sender.name} <${adminEmail}>`) : '…'}</div>
              <div><span className="font-medium">Reply-To:</span> {adminEmail || '…'}</div>
              <div><span className="font-medium">To:</span> {adminEmail || '…'} (deal admin)</div>
              <div><button type="button" className="underline" onClick={() => setShowBcc(v => !v)}><span className="font-medium">BCC:</span> {bcc.length} address{bcc.length === 1 ? '' : 'es'}</button></div>
              {showBcc && <div className="flex flex-wrap gap-1">{bcc.map(a => <Badge key={a} variant="outline" className="font-normal">{a}</Badge>)}</div>}
              <div><span className="font-medium">Emails:</span> {chunks.length} (max 50 addresses each, including To)</div>
              {!recipients.length && <p className="text-muted-foreground">No enabled vendor has an address yet. Add one in Bond Console → connector Edit entry.</p>}
              {blocker && <p className="text-destructive" role="alert">{blocker}</p>}
            </div>

            {!release && <p className="text-xs text-destructive">The saved terms have no matching saved version yet. Save the term sheet again.</p>}
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={approved} onCheckedChange={v => setApproved(v === true)} aria-label="I have reviewed this alert and approve sending it" />
              <span>I have reviewed this alert and approve sending {chunks.length} email(s) to {bcc.length + 1} address(es).</span></label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={send} disabled={!approved || busy || !saved || !release || !!blocker || stale} className="gap-1"><Send className="h-4 w-4" />{busy ? 'Sending…' : 'Approve and send'}</Button>
        </DialogFooter>

        <section className="space-y-2 border-t pt-3" aria-label="Send history">
          <h3 className="text-sm font-semibold">Send history</h3>
          {sends.length === 0 ? <p className="text-xs text-muted-foreground">No alerts sent for this deal yet.</p> : sends.map(s => (
            <div key={s.id} className="rounded-md border p-2 text-xs space-y-1">
              <div className="flex flex-wrap gap-2"><span className="font-medium">{s.subject}</span><Badge variant="secondary" className="text-[10px]">{ALERT_EVENTS.find(e => e.id === s.event)?.label ?? s.event}</Badge></div>
              <div className="text-muted-foreground">{new Date(s.created_at).toLocaleString()} · {s.sender_name}{s.sender_email ? ` <${s.sender_email}>` : ''}{s.sender_org ? ` (${s.sender_org})` : ''} · {s.provider} · terms v{s.release_version} ({s.bdt_hash.slice(0, 8)})</div>
              <ul>{[...s.alert_send_chunks].sort((a, b) => a.chunk_index - b.chunk_index).map(c => (
                <li key={c.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === 'sent' ? 'default' : c.status === 'failed' ? 'destructive' : 'outline'} className="text-[10px]">{c.status}</Badge>
                    <span>Email {c.chunk_index + 1}: {c.bcc_addresses.length} BCC · attempts {c.attempts}</span>
                    {c.status === 'failed' && <Button size="sm" variant="outline" className="h-6 gap-1 text-[11px]" onClick={() => retry(c.id)}><RotateCw className="h-3 w-3" /> Retry</Button>}
                  </div>
                  {c.status === 'failed' && c.error && <div className="text-destructive">{c.error}</div>}
                  <details><summary className="cursor-pointer text-muted-foreground">Recipients</summary><div>{c.bcc_addresses.join(', ')}</div></details>
                </li>
              ))}</ul>
            </div>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
