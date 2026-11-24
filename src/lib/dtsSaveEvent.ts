import type { BdtState } from '@/lib/bdt-bridge';
import type { DealWorkspace } from '@/lib/dealWorkspace';

export const DTS_SAVED_EVENT = 'dts:saved';
export interface DtsSavedDetail { dealId: string; state?: BdtState; ws?: DealWorkspace; notes?: string; updatedAt: string }
/** Only emit after a successful persistence response, never during typing. */
export function emitDtsSaved(detail: Omit<DtsSavedDetail, 'updatedAt'>) {
  window.dispatchEvent(new CustomEvent<DtsSavedDetail>(DTS_SAVED_EVENT, { detail: { ...detail, updatedAt: new Date().toISOString() } }));
}