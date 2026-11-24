import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BdtState } from '@/lib/bdt-bridge';
import type { DealWorkspace } from '@/lib/dealWorkspace';
import type { Deal } from '@/types/bond';
import { DTS_SAVED_EVENT, type DtsSavedDetail } from '@/lib/dtsSaveEvent';
import { unpackNotes } from '@/lib/newIssueAlerts';

export interface LastMsgSend { terms_snapshot: BdtState; body_html: string; created_at: string }
export function previousMsgText(send: LastMsgSend | null): string | undefined {
  if (!send) return;
  const doc = new DOMParser().parseFromString(send.body_html, 'text/html');
  return doc.querySelector('pre[data-msg-text]')?.textContent ?? undefined;
}
const workspace = (value: unknown): DealWorkspace | null => {
  const v = value as DealWorkspace | null;
  return v?.version === 1 && Array.isArray(v.tranches) ? v : null;
};

/** Saved data only: subscriptions and successful local saves, never Fill drafts. */
export function useLiveMessage(deal: Deal) {
  const [state, setState] = useState<BdtState | null>(deal.bdtState ?? null);
  const [ws, setWs] = useState<DealWorkspace | null>(null);
  const [stage, setStage] = useState(deal.stage);
  const [notes, setNotes] = useState({ terms: '', hash: '', legal: '' });
  const [lastSent, setLastSent] = useState<LastMsgSend | null>(null);
  const [updatedAt, setUpdatedAt] = useState(new Date().toISOString());
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let revision = 0;
    setLoaded(false);
    const load = async () => {
      const current = revision;
      const [d, n, h] = await Promise.all([
        supabase.from('deals').select('bdt_state,deal_workspace,stage,updated_at').eq('id', deal.id).maybeSingle(),
        supabase.from('deal_bulletin_notes').select('intro,notes').eq('deal_id', deal.id).maybeSingle(),
        supabase.from('alert_sends').select('terms_snapshot,body_html,created_at,alert_send_chunks(status)').eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(50),
      ]);
      if (!active) return;
      if (current !== revision) { void load(); return; }
      setError(d.error?.message || n.error?.message || h.error?.message || '');
      if (d.data) {
        setState(d.data.bdt_state as unknown as BdtState | null);
        setWs(workspace(d.data.deal_workspace));
        setStage(d.data.stage as Deal['stage']);
        setUpdatedAt(d.data.updated_at);
      }
      setNotes(n.data ? unpackNotes(n.data.notes, n.data.intro) : { terms: '', hash: '', legal: '' });
      setLastSent((h.data?.find(s => s.alert_send_chunks.some(c => c.status === 'sent')) ?? null) as unknown as LastMsgSend | null);
      setLoaded(true);
    };
    const channel = supabase.channel(`msg:${deal.id}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals', filter: `id=eq.${deal.id}` }, ({ new: row }) => {
        if (!active) return;
        revision++;
        setState(row.bdt_state as BdtState | null); setWs(workspace(row.deal_workspace)); setStage(row.stage as Deal['stage']);
        setUpdatedAt(row.updated_at || new Date().toISOString());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_bulletin_notes', filter: `deal_id=eq.${deal.id}` }, ({ new: row }) => {
        if (!active) return;
        revision++;
        const value = row as { notes?: string; intro?: string };
        setNotes(value.notes ? unpackNotes(value.notes, value.intro) : { terms: '', hash: '', legal: '' });
        setUpdatedAt(new Date().toISOString());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alert_send_chunks' }, () => { void load(); })
      .subscribe(status => {
        if (!active) return;
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void load();
      });
    const saved = (event: Event) => {
      const d = (event as CustomEvent<DtsSavedDetail>).detail;
      if (!active || d.dealId !== deal.id) return;
      revision++;
      if (d.state) setState(d.state);
      if (d.ws) setWs(d.ws);
      if (d.notes !== undefined) setNotes(unpackNotes(d.notes));
      setUpdatedAt(d.updatedAt);
    };
    window.addEventListener(DTS_SAVED_EVENT, saved);
    void load();
    return () => { active = false; window.removeEventListener(DTS_SAVED_EVENT, saved); void supabase.removeChannel(channel); };
  }, [deal.id]);
  return { state, ws, stage, notes, lastSent, updatedAt, connected, loaded, error };
}