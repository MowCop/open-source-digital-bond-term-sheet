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
  currentEmail?: string | null;
  isGuest?: boolean;
  guestDealIds?: string[];
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

/**
 * 53-bit string hash (cyrb53). Used so that the all-deals allowlist below does
 * not publish anyone's email address in the source. It is not a security
 * boundary: deal visibility is enforced by row-level security on the server.
 */
export function emailHash(email: string): string {
  const str = norm(email);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Syndicate Admins granted visibility of every deal regardless of organisation (stored as emailHash values). */
export const ALL_DEALS_ACCESS_HASHES: readonly string[] = ['5i9srdf4kv'];

export function hasAllDealsAccess(email?: string | null, allowlist: readonly string[] = ALL_DEALS_ACCESS_HASHES): boolean {
  return !!email && allowlist.includes(emailHash(email));
}

export function scopeDeals(deals: Deal[], ctx: ScopeContext): Deal[] {
  if (ctx.isGuest) {
    const allowed = new Set(ctx.guestDealIds ?? []);
    return deals.filter(d => allowed.has(d.id));
  }
  if (ctx.isMaster || !ctx.isSyndicateAdmin) return deals;
  if (hasAllDealsAccess(ctx.currentEmail)) return deals;
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