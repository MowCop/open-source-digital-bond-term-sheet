import type { Deal, Message } from '@/types/bond';
import { bdtStageForDeal } from '@/lib/bdt-bridge';
import { detectStage } from '@/lib/alertParsing';
import { stripHtml } from '@/lib/htmlText';
import { DEMO_STEPS } from '@/data/alRajhiDemo';

/** A headline describes this update; boilerplate in the body may describe other stages. */
export function updateTermSheetStage(message: Message, deal: Deal): number {
  const demo = DEMO_STEPS.find(s => message.id === `demo-${deal.id}-${s.id.replace('.', '-')}`);
  if (demo) return demo.bdtStage;
  const stageIn = (text: string): number | null => {
    if (/\bfinal terms\b|\bsettled\b/i.test(text)) return 7;
    if (/\ballocated\b|\ballocation complete\b/i.test(text)) return 6;
    if (/\bpriced\b|\bpricing term sheet\b|\bfinal pricing\b/i.test(text)) return 5;
    if (/\bspread set\b|\blaunched\b|\bbooks (?:are )?closed\b/i.test(text)) return 4;
    if (/\bguidance\b|\bbooks (?:are )?(?:open|over)\b/i.test(text)) return 3;
    if (/\bIPTs?\b|\binitial price (?:thoughts|talks?)\b/i.test(text)) return 2;
    const detected = detectStage(text);
    return detected ? bdtStageForDeal(detected) : null;
  };
  const explicit = stageIn(message.subject) ?? stageIn(stripHtml(message.body));
  if (explicit) return explicit;
  const time = (message.sentAt ?? message.createdAt).getTime();
  const transition = [...deal.stageHistory].filter(s => s.timestamp.getTime() <= time)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  return bdtStageForDeal(transition?.to ?? deal.stageHistory[0]?.from ?? deal.stage);
}

export function dtsLink(message: Message, deal: Deal): string {
  const params = new URLSearchParams({ dealId: deal.id, tab: 'fill', stage: String(updateTermSheetStage(message, deal)), at: (message.sentAt ?? message.createdAt).toISOString() });
  return `/deals?${params}`;
}

export function parseDtsStage(value: string | null): number | undefined {
  const n = Number(value);
  return value && Number.isInteger(n) && n >= 1 && n <= 7 ? n : undefined;
}

/** The board update matching a term-sheet stage: latest update at that stage, else the nearest earlier stage, else the original. */
export function boardUpdateForStage(messages: Message[], deal: Deal, stage: number): Message | undefined {
  const own = messages.filter(m => m.dealIds.includes(deal.id))
    .sort((a, b) => (a.sentAt ?? a.createdAt).getTime() - (b.sentAt ?? b.createdAt).getTime());
  if (!own.length) return undefined;
  const staged = own.map(m => ({ m, s: updateTermSheetStage(m, deal) }));
  const best = Math.max(0, ...staged.filter(x => x.s <= stage).map(x => x.s));
  const pick = staged.filter(x => x.s === best);
  return best ? pick[pick.length - 1].m : own[0];
}

export function boardLink(messages: Message[], deal: Deal, stage: number): string {
  const msg = boardUpdateForStage(messages, deal, stage);
  return `/messages?dealId=${encodeURIComponent(deal.id)}${msg ? `&messageId=${encodeURIComponent(msg.id)}` : ''}`;
}
