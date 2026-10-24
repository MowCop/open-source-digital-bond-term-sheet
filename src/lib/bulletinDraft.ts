import type { Message } from '@/types/bond';

export function findBulletinDraft(messages: Message[], dealId: string): Message | undefined {
  return messages.filter(m => m.bulletinSource === 'deal_data' && m.status === 'draft' && m.dealIds.includes(dealId))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

export function isDtsBulletinDraft(message: Message): boolean {
  return message.bulletinSource === 'deal_data' && message.status === 'draft';
}

export function buildDealBulletin(dealId: string, args: { subject: string; body: string }, senderId: string, status: 'draft' | 'sent', existing?: Message): Message {
  if (!args.subject.trim() || !args.body.trim()) throw new Error('Bulletin needs a headline and body.');
  if (existing && (!isDtsBulletinDraft(existing) || !existing.dealIds.includes(dealId))) throw new Error('This bulletin is no longer a draft. Reopen the deal and try again.');
  const now = new Date();
  return {
    id: existing?.id ?? `m${crypto.randomUUID()}`,
    dealIds: [dealId], subject: args.subject.trim(), body: args.body,
    status, senderId: existing?.senderId ?? senderId,
    recipients: [], attachments: [], createdAt: existing?.createdAt ?? now,
    updatedAt: now, sentAt: status === 'sent' ? now : undefined, bulletinSource: 'deal_data',
  };
}