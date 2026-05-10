import type { Deal, User, DistributionList } from '@/types/bond';

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
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

export function scopeDeals(deals: Deal[], ctx: ScopeContext): Deal[] {
  if (ctx.isMaster || !ctx.isSyndicateAdmin) return deals;
  const org = norm(ctx.currentOrg);
  if (!org) return [];
  return deals.filter(d => {
    if (norm(d.createdByOrg) === org) return true;
    return (d.bookrunners ?? []).some(b => norm(b.name) === org);
  });
}

export function scopeUsers(users: User[], ctx: ScopeContext): User[] {
  if (ctx.isMaster || !ctx.isSyndicateAdmin) return users;
  const org = norm(ctx.currentOrg);
  if (!org) return [];
  return users.filter(u =>
    norm(u.organization) === org ||
    norm(u.createdByOrg) === org
  );
}

export function scopeDistributionLists(lists: DistributionList[], ctx: ScopeContext): DistributionList[] {
  if (ctx.isMaster || !ctx.isSyndicateAdmin) return lists;
  const org = norm(ctx.currentOrg);
  if (!org) return [];
  return lists.filter(l => norm(l.createdByOrg) === org);
}