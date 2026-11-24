import type { Deal, UserRole } from '@/types/bond';
import { termSheetView } from './termSheetView';
import { dealToBdtState, type BdtState, type CheckItem } from './bdt-bridge';
import type { DealWorkspace } from './dealWorkspace';
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
export const CHECKLIST = [
  { key: 'structure', role: 'dcm', label: 'Structure & tranches' },
  { key: 'size', role: 'dcm', label: 'Size' },
  { key: 'tenor', role: 'dcm', label: 'Tenor' },
  { key: 'bookrunners', role: 'dcm', label: 'Bookrunners' },
  { key: 'issuer', role: 'issuer_legal', label: 'Issuer details & LEI' },
  { key: 'law', role: 'issuer_legal', label: 'Governing law' },
  { key: 'restrictions', role: 'issuer_legal', label: 'Selling restrictions & legends' },
  { key: 'target', role: 'issuer_legal', label: 'MiFID target market' },
  { key: 'documents', role: 'counsel', label: 'Documents reviewed' },
  { key: 'listing', role: 'counsel', label: 'Listing' },
  { key: 'stabilisation', role: 'counsel', label: 'Stabilisation' },
  { key: 'notices', role: 'counsel', label: 'Legal notices' },
] as const;
export function checklistEvidence(state: BdtState, ws: DealWorkspace | null, documentCount: number): Record<string, boolean> {
  const v = termSheetView(state), f = state.f;
  return { structure: !!ws?.tranches.length, size: !!v.size && (!ws || ws.tranches.every(t => t.amount != null && t.amount > 0)), tenor: !!v.tenor || !!ws?.tranches.every(t => !!t.tenor), bookrunners: v.bookrunners.length > 0,
    issuer: !!v.issuerName && !!v.issuerLEI, law: !!v.governingLaw,
    restrictions: !!f['IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode'] && !!f['IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction'],
    target: !!f['IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType'], documents: documentCount > 0, listing: !!f['IssuanceDataGroup/Issuance/Listing/Listed'], stabilisation: !!f['x:stabilisation'], notices: documentCount > 0 };
}
export function executionReadiness(checks: Pick<CheckItem, 'l'>[], signoffs: Signoff[], evidence: Record<string, boolean>, dirty = false) {
  const blocking = checks.filter(c => c.l === 'fail').length;
  const outstanding = CHECKLIST.filter(i => !evidence[i.key] || !signoffs.some(s => s.item_key === i.key && s.role === i.role && s.status === 'signed_off'));
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