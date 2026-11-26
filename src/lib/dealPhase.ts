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
export function quickCommands(deal: Deal): string[] {
  if (dealPhase(deal) === 'closed') return [];
  if (deal.stage === 'Priced') return ['Price at … / coupon … / re-offer yield …', 'Size the 10s at …, 30s at …', 'Deal size … USD equivalent', 'Draft final terms update'];
  if (['Launched', 'Books Closed'].includes(deal.stage)) return ['Size the 10s at …, 30s at …', 'Skew to the long end', 'Deal size benchmark WNG', 'Price talk tranche A …', 'Price at … / coupon … / re-offer yield …'];
  if (deal.stage === 'Books Open') return ['Guidance tranche A … +/- 5bp WPIR', 'Yield talk tranche A …', 'Skew to the long end', 'Books update …bn ex-JLM', 'Close books'];
  return ['IPTs tranche A … area', 'Price talk tranche A … area', 'Yield talk tranche A … area', 'Deal size benchmark', 'Skew to the long end', 'Add a … floating tranche'];
}
