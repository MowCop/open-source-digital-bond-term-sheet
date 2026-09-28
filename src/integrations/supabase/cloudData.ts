import { supabase } from './client';
import type {
  Deal, User, Bookrunner, StageTransition, DealStage, UserRole, UserCategory,
  Message, MessageStatus, AuditLogEntry, Notification, DistributionList,
  ChatChannel, ChatMessage, Attachment, AISuggestion,
} from '@/types/bond';

// The generated `types.ts` regenerates after migrations; until it picks up the new
// `users` / `deals` tables, we cast through `any` at this single integration boundary.
// All other app code stays strictly typed against `Deal` / `User`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ---------- Users ----------
interface UserRow {
  id: string; name: string; email: string; phone: string | null;
  role: string; organization: string; organization_type: string;
  category: string | null; created_at: string; created_by: string | null;
  created_by_org?: string | null;
}

function rowToUser(r: UserRow): User {
  return {
    id: r.id, name: r.name, email: r.email,
    phone: r.phone ?? undefined,
    role: r.role as UserRole,
    organization: r.organization,
    organizationType: r.organization_type as 'bank' | 'vendor',
    category: (r.category ?? undefined) as UserCategory | undefined,
    createdAt: r.created_at ? new Date(r.created_at) : undefined,
    createdBy: r.created_by ?? undefined,
    createdByOrg: r.created_by_org ?? undefined,
  };
}

function userToRow(u: User): UserRow {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone ?? null,
    role: u.role, organization: u.organization, organization_type: u.organizationType,
    category: u.category ?? null,
    created_at: (u.createdAt ?? new Date()).toISOString(),
    created_by: u.createdBy ?? null,
    created_by_org: u.createdByOrg ?? null,
  };
}

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await db.from('users').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data as UserRow[]).map(rowToUser);
}
export async function insertUser(u: User) {
  const { error } = await db.from('users').insert(userToRow(u));
  if (error) throw error;
}
export async function updateUserRow(id: string, updates: Partial<User>) {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.phone !== undefined) patch.phone = updates.phone ?? null;
  if (updates.role !== undefined) patch.role = updates.role;
  if (updates.organization !== undefined) patch.organization = updates.organization;
  if (updates.organizationType !== undefined) patch.organization_type = updates.organizationType;
  if (updates.category !== undefined) patch.category = updates.category ?? null;
  if (updates.createdByOrg !== undefined) patch.created_by_org = updates.createdByOrg ?? null;
  const { error } = await db.from('users').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteUserRow(id: string) {
  const { error } = await db.from('users').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Deals ----------
// All Deal fields except id/createdAt/updatedAt/stageHistory/bookrunners are flat.
const dealFieldMap: Record<string, string> = {
  stage: 'stage',
  issuerName: 'issuer_name', issuerLEI: 'issuer_lei', issuerRating: 'issuer_rating',
  ratingOutlook: 'rating_outlook',
  issuanceType: 'issuance_type', currency: 'currency', size: 'size',
  specifiedDenomination: 'specified_denomination',
  pricingDate: 'pricing_date', issueDate: 'issue_date', settlementDate: 'settlement_date',
  issuePrice: 'issue_price', reofferPrice: 'reoffer_price', reofferYield: 'reoffer_yield',
  reofferSpread: 'reoffer_spread', midSwapRate: 'mid_swap_rate', coupon: 'coupon',
  governingLaw: 'governing_law', sellingRestrictions: 'selling_restrictions',
  listingVenue: 'listing_venue',
  isin: 'isin', cusip: 'cusip', commonCode: 'common_code',
  formOfNote: 'form_of_note', statusOfNote: 'status_of_note',
  tenor: 'tenor', maturityDate: 'maturity_date',
  interestType: 'interest_type', interestRate: 'interest_rate',
  interestPaymentFrequency: 'interest_payment_frequency',
  dayCountFraction: 'day_count_fraction', businessDayConvention: 'business_day_convention',
  optionality: 'optionality', taxonomy: 'taxonomy',
  ipt: 'ipt', guidance: 'guidance', benchmark: 'benchmark', referenceRate: 'reference_rate',
  createdByOrg: 'created_by_org',
  extractionSnapshot: 'extraction_snapshot',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDeal(r: any): Deal {
  const out: Partial<Deal> = {
    id: r.id,
    stage: r.stage as DealStage,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    stageHistory: (r.stage_history as StageTransition[]).map(s => ({ ...s, timestamp: new Date(s.timestamp) })),
    bookrunners: (r.bookrunners as Bookrunner[]) ?? [],
    issuerName: r.issuer_name,
    currency: r.currency,
    size: r.size,
    coupon: r.coupon,
    tenor: r.tenor,
  };
  for (const [tsKey, dbKey] of Object.entries(dealFieldMap)) {
    if (out[tsKey as keyof Deal] !== undefined) continue;
    const v = r[dbKey];
    if (v !== null && v !== undefined) (out as Record<string, unknown>)[tsKey] = v;
  }
  return out as Deal;
}

function dealToRow(d: Deal): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: d.id,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
    stage_history: d.stageHistory,
    bookrunners: d.bookrunners ?? [],
  };
  for (const [tsKey, dbKey] of Object.entries(dealFieldMap)) {
    const v = (d as unknown as Record<string, unknown>)[tsKey];
    row[dbKey] = v === undefined ? null : v;
  }
  return row;
}

function dealUpdatesToRow(updates: Partial<Deal>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.stageHistory !== undefined) row.stage_history = updates.stageHistory;
  if (updates.bookrunners !== undefined) row.bookrunners = updates.bookrunners;
  for (const [tsKey, dbKey] of Object.entries(dealFieldMap)) {
    if (tsKey in updates) {
      const v = (updates as unknown as Record<string, unknown>)[tsKey];
      row[dbKey] = v === undefined ? null : v;
    }
  }
  return row;
}

export async function fetchDeals(): Promise<Deal[]> {
  const { data, error } = await db.from('deals').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(rowToDeal);
}
export async function insertDeal(d: Deal) {
  const { error } = await db.from('deals').insert(dealToRow(d));
  if (error) throw error;
}
export async function updateDealRow(id: string, updates: Partial<Deal>) {
  const patch = dealUpdatesToRow(updates);
  const { error } = await db.from('deals').update(patch).eq('id', id);
  if (error) throw error;
}

export { rowToDeal, rowToUser };

// ---------- Messages ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMessage(r: any): Message {
  return {
    id: r.id,
    dealIds: (r.deal_ids ?? []) as string[],
    subject: r.subject,
    body: r.body,
    status: r.status as MessageStatus,
    senderId: r.sender_id,
    recipients: (r.recipients ?? []) as string[],
    attachments: (r.attachments ?? []) as Attachment[],
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    sentAt: r.sent_at ? new Date(r.sent_at) : undefined,
    retractedAt: r.retracted_at ? new Date(r.retracted_at) : undefined,
    retractedBy: r.retracted_by ?? undefined,
    threadId: r.thread_id ?? undefined,
    parentMessageId: r.parent_message_id ?? undefined,
    aiSuggestions: (r.ai_suggestions ?? undefined) as AISuggestion | undefined,
    bulletinSource: (r.bulletin_source ?? undefined) as Message['bulletinSource'],
  };
}
function messageToRow(m: Message): Record<string, unknown> {
  return {
    id: m.id,
    deal_ids: m.dealIds,
    subject: m.subject,
    body: m.body,
    status: m.status,
    sender_id: m.senderId,
    recipients: m.recipients,
    attachments: m.attachments,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
    sent_at: m.sentAt ? m.sentAt.toISOString() : null,
    retracted_at: m.retractedAt ? m.retractedAt.toISOString() : null,
    retracted_by: m.retractedBy ?? null,
    thread_id: m.threadId ?? null,
    parent_message_id: m.parentMessageId ?? null,
    ai_suggestions: m.aiSuggestions ?? null,
    bulletin_source: m.bulletinSource ?? null,
  };
}
function messageUpdatesToRow(u: Partial<Message>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (u.dealIds !== undefined) r.deal_ids = u.dealIds;
  if (u.subject !== undefined) r.subject = u.subject;
  if (u.body !== undefined) r.body = u.body;
  if (u.status !== undefined) r.status = u.status;
  if (u.senderId !== undefined) r.sender_id = u.senderId;
  if (u.recipients !== undefined) r.recipients = u.recipients;
  if (u.attachments !== undefined) r.attachments = u.attachments;
  if (u.updatedAt !== undefined) r.updated_at = u.updatedAt.toISOString();
  if (u.sentAt !== undefined) r.sent_at = u.sentAt ? u.sentAt.toISOString() : null;
  if (u.retractedAt !== undefined) r.retracted_at = u.retractedAt ? u.retractedAt.toISOString() : null;
  if (u.retractedBy !== undefined) r.retracted_by = u.retractedBy ?? null;
  if (u.threadId !== undefined) r.thread_id = u.threadId ?? null;
  if (u.parentMessageId !== undefined) r.parent_message_id = u.parentMessageId ?? null;
  if (u.aiSuggestions !== undefined) r.ai_suggestions = u.aiSuggestions ?? null;
  if (u.bulletinSource !== undefined) r.bulletin_source = u.bulletinSource ?? null;
  return r;
}
export async function fetchMessages(): Promise<Message[]> {
  const { data, error } = await db.from('messages').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(rowToMessage);
}
export async function insertMessage(m: Message) {
  const { error } = await db.from('messages').insert(messageToRow(m));
  if (error) throw error;
}
export async function updateMessageRow(id: string, u: Partial<Message>) {
  const { error } = await db.from('messages').update(messageUpdatesToRow(u)).eq('id', id);
  if (error) throw error;
}
export async function deleteMessageRow(id: string) {
  const { error } = await db.from('messages').delete().eq('id', id);
  if (error) throw error;
}
export async function deleteMessagesByDealKey(dealIds: string[]) {
  // Delete client-side after fetching (deal_ids is jsonb array — exact match harder via REST).
  const all = await fetchMessages();
  const key = dealIds.join(',');
  const ids = all.filter(m => m.dealIds.join(',') === key).map(m => m.id);
  if (ids.length === 0) return;
  const { error } = await db.from('messages').delete().in('id', ids);
  if (error) throw error;
}

export async function deleteMessagesContainingDeal(dealId: string) {
  const all = await fetchMessages();
  const ids = all.filter(m => m.dealIds.includes(dealId)).map(m => m.id);
  if (ids.length === 0) return;
  const { error } = await db.from('messages').delete().in('id', ids);
  if (error) throw error;
}

export async function deleteDealRow(id: string) {
  const { error } = await db.from('deals').delete().eq('id', id);
  if (error) throw error;
}
export async function deleteChatChannelsByDeal(dealId: string) {
  const { error } = await db.from('chat_channels').delete().eq('deal_id', dealId);
  if (error) throw error;
}
export async function deleteChatMessagesByDeal(dealId: string) {
  const { error } = await db.from('chat_messages').delete().eq('deal_id', dealId);
  if (error) throw error;
}
export async function deleteNotificationsByDeal(dealId: string) {
  const { error } = await db.from('notifications').delete().eq('deal_id', dealId);
  if (error) throw error;
}

export async function deleteChatChannelRow(id: string) {
  const { error } = await db.from('chat_channels').delete().eq('id', id);
  if (error) throw error;
}
export async function deleteChatMessagesByChannel(channelId: string) {
  const { error } = await db.from('chat_messages').delete().eq('channel_id', channelId);
  if (error) throw error;
}

/**
 * Backfill / patch chat_messages rows by channel_id.
 * Used when an existing chat channel is re-linked to a newly-extracted deal,
 * so all prior messages inherit the new deal_id and stay bound to the deal
 * through future deletes / scoping queries.
 */
export async function updateChatMessagesByChannel(
  channelId: string,
  patch: { deal_id?: string | null },
) {
  const { error } = await db.from('chat_messages').update(patch).eq('channel_id', channelId);
  if (error) throw error;
}

// ---------- Audit log ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAudit(r: any): AuditLogEntry {
  return {
    id: r.id, action: r.action,
    entityType: r.entity_type as AuditLogEntry['entityType'],
    entityId: r.entity_id, userId: r.user_id,
    timestamp: new Date(r.timestamp),
    details: r.details,
    ipAddress: r.ip_address ?? undefined,
  };
}
function auditToRow(a: AuditLogEntry): Record<string, unknown> {
  return {
    id: a.id, action: a.action,
    entity_type: a.entityType, entity_id: a.entityId, user_id: a.userId,
    timestamp: a.timestamp.toISOString(),
    details: a.details, ip_address: a.ipAddress ?? null,
  };
}
export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const { data, error } = await db.from('audit_log').select('*').order('timestamp', { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(rowToAudit);
}
export async function insertAudit(a: AuditLogEntry) {
  const { error } = await db.from('audit_log').insert(auditToRow(a));
  if (error) throw error;
}

// ---------- Notifications ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToNotification(r: any): Notification {
  return {
    id: r.id, userId: r.user_id,
    type: r.type as Notification['type'],
    title: r.title, body: r.body, read: r.read,
    timestamp: new Date(r.timestamp),
    dealId: r.deal_id ?? undefined,
    messageId: r.message_id ?? undefined,
  };
}
function notificationToRow(n: Notification): Record<string, unknown> {
  return {
    id: n.id, user_id: n.userId, type: n.type,
    title: n.title, body: n.body, read: n.read,
    timestamp: n.timestamp.toISOString(),
    deal_id: n.dealId ?? null, message_id: n.messageId ?? null,
  };
}
export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await db.from('notifications').select('*').order('timestamp', { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(rowToNotification);
}
export async function insertNotification(n: Notification) {
  const { error } = await db.from('notifications').insert(notificationToRow(n));
  if (error) throw error;
}
export async function markNotificationReadRow(id: string) {
  const { error } = await db.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

// ---------- Distribution lists ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDistList(r: any): DistributionList {
  return {
    id: r.id, name: r.name,
    memberIds: (r.member_ids ?? []) as string[],
    vendorIds: (r.vendor_ids ?? []) as string[],
    createdBy: r.created_by,
    createdByOrg: r.created_by_org ?? undefined,
    lastUsed: r.last_used ? new Date(r.last_used) : undefined,
  };
}
function distListToRow(d: DistributionList): Record<string, unknown> {
  return {
    id: d.id, name: d.name,
    member_ids: d.memberIds, vendor_ids: d.vendorIds,
    created_by: d.createdBy,
    created_by_org: d.createdByOrg ?? null,
    last_used: d.lastUsed ? d.lastUsed.toISOString() : null,
  };
}
function distListUpdatesToRow(u: Partial<DistributionList>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (u.name !== undefined) r.name = u.name;
  if (u.memberIds !== undefined) r.member_ids = u.memberIds;
  if (u.vendorIds !== undefined) r.vendor_ids = u.vendorIds;
  if (u.createdBy !== undefined) r.created_by = u.createdBy;
  if (u.createdByOrg !== undefined) r.created_by_org = u.createdByOrg ?? null;
  if (u.lastUsed !== undefined) r.last_used = u.lastUsed ? u.lastUsed.toISOString() : null;
  return r;
}
export async function fetchDistributionLists(): Promise<DistributionList[]> {
  const { data, error } = await db.from('distribution_lists').select('*');
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(rowToDistList);
}
export async function insertDistributionList(d: DistributionList) {
  const { error } = await db.from('distribution_lists').insert(distListToRow(d));
  if (error) throw error;
}
export async function updateDistributionListRow(id: string, u: Partial<DistributionList>) {
  const { error } = await db.from('distribution_lists').update(distListUpdatesToRow(u)).eq('id', id);
  if (error) throw error;
}
export async function deleteDistributionListRow(id: string) {
  const { error } = await db.from('distribution_lists').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Chat channels ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToChatChannel(r: any): ChatChannel {
  return {
    id: r.id,
    participantIds: (r.participant_ids ?? []) as string[],
    dealId: r.deal_id ?? undefined,
    label: r.label,
    createdAt: new Date(r.created_at),
  };
}
function chatChannelToRow(c: ChatChannel): Record<string, unknown> {
  return {
    id: c.id, participant_ids: c.participantIds,
    deal_id: c.dealId ?? null, label: c.label,
    created_at: c.createdAt.toISOString(),
  };
}
export async function fetchChatChannels(): Promise<ChatChannel[]> {
  const { data, error } = await db.from('chat_channels').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(rowToChatChannel);
}
export async function insertChatChannel(c: ChatChannel) {
  const { error } = await db.from('chat_channels').insert(chatChannelToRow(c));
  if (error) throw error;
}

export async function updateChatChannel(
  id: string,
  patch: Partial<Pick<ChatChannel, 'label' | 'participantIds' | 'dealId'>>,
) {
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.participantIds !== undefined) row.participant_ids = patch.participantIds;
  if (patch.dealId !== undefined) row.deal_id = patch.dealId ?? null;
  if (Object.keys(row).length === 0) return;
  const { error } = await db.from('chat_channels').update(row).eq('id', id);
  if (error) throw error;
}

// ---------- Chat messages ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToChatMessage(r: any): ChatMessage {
  return {
    id: r.id, channelId: r.channel_id,
    dealId: r.deal_id ?? undefined,
    senderId: r.sender_id, senderName: r.sender_name,
    senderType: r.sender_type as ChatMessage['senderType'],
    body: r.body,
    attachments: (r.attachments ?? []) as Attachment[],
    linkedMessageId: r.linked_message_id ?? undefined,
    timestamp: new Date(r.timestamp),
  };
}
function chatMessageToRow(m: ChatMessage): Record<string, unknown> {
  return {
    id: m.id, channel_id: m.channelId,
    deal_id: m.dealId ?? null,
    sender_id: m.senderId, sender_name: m.senderName, sender_type: m.senderType,
    body: m.body, attachments: m.attachments,
    linked_message_id: m.linkedMessageId ?? null,
    timestamp: m.timestamp.toISOString(),
  };
}
export async function fetchChatMessages(): Promise<ChatMessage[]> {
  const { data, error } = await db.from('chat_messages').select('*').order('timestamp', { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(rowToChatMessage);
}
export async function insertChatMessage(m: ChatMessage) {
  const { error } = await db.from('chat_messages').insert(chatMessageToRow(m));
  if (error) throw error;
}

export { rowToMessage, rowToAudit, rowToNotification, rowToDistList, rowToChatChannel, rowToChatMessage };