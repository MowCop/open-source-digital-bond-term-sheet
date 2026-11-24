import type { Deal, UserRole } from '@/types/bond';
import { termSheetView } from './termSheetView';
import { dealToBdtState, type BdtState, type CheckItem } from './bdt-bridge';
import type { DealWorkspace } from './dealWorkspace';
import { emptyState } from './termsheet/index.js';
/** Empty collection defaults let incomplete legacy records be checked without inventing terms. */
export function executionGateState(saved: Partial<BdtState> | null): BdtState {
  return { ...emptyState(), ...saved, f: saved?.f ?? {}, parties: saved?.parties ?? [], ids: saved?.ids ?? [], ratings: saved?.ratings ?? [], docs: saved?.docs ?? [] };
}
export type DealPhase = 'setup' | 'execution' | 'closed';
export type ActorRole = 'dcm' | 'issuer_legal' | 'counsel';
export const ACTOR_LABELS: Record<ActorRole, string> = { dcm: 'DCM', issuer_legal: 'Issuer legal', counsel: 'Deal counsel' };
export function dealPhase(deal: Pick<Deal, 'stage' | 'bdtState'>): DealPhase {
  if (deal.stage === 'Settled') return 'closed';
  if (!['Mandate', 'Announced'].includes(deal.stage) || Number(deal.bdtState?.stage ?? 1) >= 2 || deal.bdtState?.f?.['x:iptSpread']) return 'execution';
  return 'setup';
}
export const STRUCTURE_PATHS = ['IssuanceDataGroup/Issuance/SpecifiedCurrency', 'IssuanceDataGroup/Product/AggregateNominalAmount/Currency', 'IssuanceDataGroup/Issuance/TotalAggregateAmount/Value', 'IssuanceDataGroup/Product/AggregateNominalAmount/Value', 'IssuanceDataGroup/Product/Maturity/MaturityDate', 'IssuanceDataGroup/Product/InterestPayment/InterestType'];
export function mayEditField(role: UserRole, phase: DealPhase, path: string): boolean {
  if (phase === 'closed') return false;
  if (role === 'master_admin' || role === 'syndicate_admin') return true;
  if (role === 'dcm') return STRUCTURE_PATHS.includes(path) || path === 'group:parties';
  return phase === 'setup' && (role === 'issuer_legal' || role === 'counsel');
}
export interface Signoff { item_key: string; role: ActorRole; user_id: string; status: 'open' | 'in_review' | 'signed_off'; updated_at: string }
/** Definitions come from signoff_item_fields(), also used by the database triggers. */
export interface SignoffItem { key: string; role: ActorRole; label: string; fields: string[]; workspace: string[]; tranche: string[]; parties: string[]; bulletin?: string[] }
export interface PhaseAudit { action: string; userName: string; at: string; details: { item?: string; changedFields?: string[]; note?: string; openItems?: unknown[]; blockingChecks?: unknown[] } }
export function checklistEvidence(state: BdtState, ws: DealWorkspace | null, documentCount: number): Record<string, boolean> {
  const v = termSheetView(state), f = state.f;
  return { structure: !!ws?.tranches.length, size: !!v.size && (!ws || ws.tranches.every(t => t.amount != null && t.amount > 0)), tenor: !!v.tenor || !!ws?.tranches.every(t => !!t.tenor), bookrunners: v.bookrunners.length > 0,
    issuer: !!v.issuerName && !!v.issuerLEI, law: !!v.governingLaw,
    restrictions: !!f['IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode'] && !!f['IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction'],
    target: !!f['IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType'], documents: documentCount > 0, listing: !!f['IssuanceDataGroup/Issuance/Listing/Listed'], stabilisation: !!f['x:stabilisation'], notices: documentCount > 0 };
}
export function executionReadiness(checks: Pick<CheckItem, 'l'>[], signoffs: Signoff[], evidence: Record<string, boolean>, dirty: boolean, team: { role: string }[], items: SignoffItem[]) {
  const blocking = checks.filter(c => c.l === 'fail').length;
  const required = items.filter(i => team.some(t => t.role === i.role));
  const outstanding = required.filter(i => !evidence[i.key] || !signoffs.some(s => s.item_key === i.key && s.role === i.role && s.status === 'signed_off'));
  return { ready: !dirty && !blocking && !outstanding.length, blocking, outstanding };
}
export function quickCommands(deal: Deal): string[] {
  if (dealPhase(deal) === 'closed') return [];
  if (deal.stage === 'Priced') return ['Price at … / coupon … / re-offer …', 'Draft final terms update'];
  if (['Launched', 'Books Closed'].includes(deal.stage)) return ['Set Tranche A size …', 'Launch at …', 'Price at … / coupon … / re-offer …'];
  if (deal.stage === 'Books Open') return ['Books update £…bn ex-JLM', 'Revise guidance to …', 'Close books'];
  return ['Announce IPTs …', 'Open books'];
}
export const savedEvidence = (deal: Deal, ws: DealWorkspace | null, docs: number) => checklistEvidence(dealToBdtState(deal), ws, docs);