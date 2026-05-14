import type { Deal, User, DistributionList, Message, AuditLogEntry } from '@/types/bond';

/**
 * Org-based tenant isolation for Syndicate Admins.
 * Master Admin and non-scoped users see everything.
 * Syndicate Admins see only data tagged with their organization.
 */

export interface ScopeContext {
  isMaster: boolean;
  isSyndicateAdmin: boolean;
  currentOrg: string | null;
  currentAuthUserId?: string | null;
  currentUserId?: string | null;
  isGuest?: boolean;
  guestDealIds?: string[];
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

export function scopeDeals(deals: Deal[], ctx: ScopeContext): Deal[] {
  if (ctx.isGuest) {
    const allowed = new Set(ctx.guestDealIds ?? []);
    return deals.filter(d => allowed.has(d.id));
  }
  if (ctx.isMaster || !ctx.isSyndicateAdmin) return deals;
  const org = norm(ctx.currentOrg);
  if (!org) return [];
  return deals.filter(d => {
    if (norm(d.createdByOrg) === org) return true;
    return (d.bookrunners ?? []).some(b => norm(b.name) === org);
  });
}

export function scopeUsers(users: User[], ctx: ScopeContext): User[] {
  if (ctx.isGuest) return [];
  // Syndicate Admins, Syndicate Read-Only, and Master Admin all see every user
  // so they can chat with and add anyone set up by any Syndicate Admin.
  return users;
}

export function scopeDistributionLists(lists: DistributionList[], ctx: ScopeContext): DistributionList[] {
  if (ctx.isGuest) return [];
  if (ctx.isMaster || !ctx.isSyndicateAdmin) return lists;
  const org = norm(ctx.currentOrg);
  if (!org) return [];
  return lists.filter(l => norm(l.createdByOrg) === org);
}

export function scopeMessages(messages: Message[], ctx: ScopeContext): Message[] {
  if (!ctx.isGuest) return messages;
  const allowed = new Set(ctx.guestDealIds ?? []);
  return messages.filter(m => (m.dealIds ?? []).some(id => allowed.has(id)));
}

/**
 * Syndicate Admins should only see their own activity in the audit log.
 * Master Admin sees everything. Guests see nothing.
 */
export function scopeAuditLog(entries: AuditLogEntry[], ctx: ScopeContext): AuditLogEntry[] {
  if (ctx.isGuest) return [];
  if (ctx.isMaster) return entries;
  if (!ctx.isSyndicateAdmin) return entries;
  const ids = new Set<string>();
  if (ctx.currentUserId) ids.add(ctx.currentUserId);
  if (ctx.currentAuthUserId) ids.add(ctx.currentAuthUserId);
  return entries.filter(e => ids.has(e.userId) && (e.entityType as string) !== 'master_admin');
}