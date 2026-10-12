/**
 * Demo controls for the Al Rajhi Bank Tier 2 Social Sukuk deal.
 * - setupAlRajhiDemo: creates the deal, its chat with illustrative pre-marketing
 *   messages, stores the Offering Circular + Supplement and saves one term sheet
 *   history version per stage (Announcement → Priced).
 * - AlRajhiDemoPanel: "Next message" replays the real syndicate blasts in order;
 *   each one is posted to the deal chat and sent through the normal document
 *   parser, so its values appear as Fill proposals for review (never auto-applied).
 */
import { useState } from 'react';
import { Play, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { deleteChatMessagesByChannel } from '@/integrations/supabase/cloudData';
import { useApp } from '@/context/AppContext';
import { uploadDealDocument } from '@/lib/dealDocuments';
import { dealToBdtState, refreshAuto, bdtStageLabel } from '@/lib/bdt-bridge';
import type { Deal, ChatChannel } from '@/types/bond';
import {
  DEMO_BASE, DEMO_STEPS, PRE_MARKETING, DEMO_ATTACHMENTS, demoStageSnapshots,
} from '@/data/alRajhiDemo';

const stepKey = (dealId: string) => `vdr.demo.step.${dealId}`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitForRow(table: 'deals' | 'chat_channels', id: string) {
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from(table).select('id').eq('id', id).maybeSingle();
    if (data) return true;
    await sleep(300);
  }
  return false;
}

type App = ReturnType<typeof useApp>;

function demoChannel(app: App, dealId: string): ChatChannel {
  return app.createDealChannel(dealId, 'Al Rajhi Tier 2 Sukuk – Syndicate', []);
}

async function postPreMarketing(app: App, dealId: string, channelId: string) {
  for (const text of PRE_MARKETING) {
    app.sendChatMessage(channelId, text, [], undefined, dealId);
    await sleep(150);
  }
}

export async function setupAlRajhiDemo(app: App): Promise<Deal> {
  const deal = app.createDeal({ ...DEMO_BASE });
  await waitForRow('deals', deal.id);
  const ch = demoChannel(app, deal.id);
  await waitForRow('chat_channels', ch.id);
  await postPreMarketing(app, deal.id, ch.id);

  // Stored documents (sent with message 1.1).
  for (const a of DEMO_ATTACHMENTS) {
    try {
      const blob = await (await fetch(a.url)).blob();
      await uploadDealDocument(deal.id, new File([blob], a.name, { type: 'application/pdf' }));
    } catch (e) { console.error('[demo] document upload failed', a.name, e); }
  }

  // One saved history version per term sheet step.
  const { data: u } = await supabase.auth.getUser();
  let version = 0;
  for (const s of demoStageSnapshots()) {
    const st = dealToBdtState({ ...deal, ...s.deal, id: deal.id, bdtState: undefined } as Deal);
    st.stage = s.bdtStage;
    st.docs = DEMO_ATTACHMENTS.map(a => ({ name: a.name.replace(/\.pdf$/, ''), date: '2026-09-03', link: a.url, version: '' })) as never;
    refreshAuto(st);
    version += 1;
    const { error } = await supabase.from('deal_term_sheet_releases').insert({
      deal_id: deal.id, version, stage: s.bdtStage, stage_label: bdtStageLabel(s.bdtStage),
      bdt_state_snapshot: st as never, diff_summary: { demo: true, source: s.label } as never,
      checks_summary: {} as never, released_by: u.user?.id ?? null,
      released_by_name: 'Demo seed (Al Rajhi reference files)',
    });
    if (error) console.error('[demo] snapshot insert failed', error);
  }
  localStorage.setItem(stepKey(deal.id), '0');
  return deal;
}

interface Props {
  deal: Deal;
  /** Sends replayed text through the Fill parser; resolves with proposals found. */
  ingest: (files: File[]) => Promise<number | undefined>;
}

export default function AlRajhiDemoPanel({ deal, ingest }: Props) {
  const app = useApp();
  const [step, setStep] = useState<number>(() => Number(localStorage.getItem(stepKey(deal.id)) ?? 0));
  const [busy, setBusy] = useState(false);
  const next = DEMO_STEPS[step];

  const save = (n: number) => { localStorage.setItem(stepKey(deal.id), String(n)); setStep(n); };

  const playNext = async () => {
    if (!next) return;
    setBusy(true);
    try {
      const ch = demoChannel(app, deal.id);
      const time = new Date(next.sentAt).toISOString().slice(11, 16);
      const attachments = next.attachments
        ? DEMO_ATTACHMENTS.map((a, i) => ({ id: `demo-${i}`, name: a.name, type: 'pdf' as const, size: a.size, url: a.url, mimeType: 'application/pdf' }))
        : [];
      app.sendChatMessage(ch.id, `[Syndicate blast ${next.id} · ${time} UTC]\n${next.body}`, attachments, undefined, deal.id);
      if (next.stage !== deal.stage) app.updateDeal(deal.id, { stage: next.stage });
      const found = await ingest([new File([next.body], `Al Rajhi blast ${next.id}.txt`, { type: 'text/plain' })]);
      toast.success(`Message ${next.id} sent — ${next.label}`, {
        description: found ? `${found} values proposed in Fill for review` : 'No new values to propose',
      });
      save(step + 1);
    } finally { setBusy(false); }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const ch = demoChannel(app, deal.id);
      await deleteChatMessagesByChannel(ch.id);
      await postPreMarketing(app, deal.id, ch.id);
      app.updateDeal(deal.id, { stage: 'Announced' });
      save(0);
      toast.success('Demo replay reset to the start');
    } catch (e) {
      toast.error('Could not reset the demo', { description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs">
      <span className="font-medium">Demo replay</span>
      <span className="text-muted-foreground">
        {next ? `Next: ${next.id} – ${next.label} (${step + 1}/${DEMO_STEPS.length})` : 'All messages sent — deal priced'}
        {' · '}History: {bdtStageLabel(1)} → {bdtStageLabel(5)}
      </span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" onClick={playNext} disabled={!next || busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />} Next message
        </Button>
        <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>
      </div>
    </div>
  );
}
