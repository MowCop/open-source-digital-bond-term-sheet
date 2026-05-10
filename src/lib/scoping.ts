import type { Deal, User, DistributionList, Message } from '@/types/bond';

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
  if (ctx.isMaster || !ctx.isSyndicateAdmin) return users;
  const org = norm(ctx.currentOrg);
  if (!org) return [];
  return users.filter(u =>
    norm(u.organization) === org ||
    norm(u.createdByOrg) === org
  );
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