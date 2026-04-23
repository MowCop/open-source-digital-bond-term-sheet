import { supabase } from './client';
import type { Deal, User, Bookrunner, StageTransition, DealStage, UserRole, UserCategory } from '@/types/bond';

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
  };
}

function userToRow(u: User): UserRow {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone ?? null,
    role: u.role, organization: u.organization, organization_type: u.organizationType,
    category: u.category ?? null,
    created_at: (u.createdAt ?? new Date()).toISOString(),
    created_by: u.createdBy ?? null,
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
    const v = (d as Record<string, unknown>)[tsKey];
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
      const v = (updates as Record<string, unknown>)[tsKey];
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