import type { BdtState } from '@/lib/bdt-bridge';
import type { DealWorkspace } from '@/lib/dealWorkspace';
import { scopeOf } from '@/lib/trancheFields';

/** BDT state for one tranche: Tranche A = main state; others overlay their own/copied values. */
export function trancheBdtState(main: BdtState, ws: DealWorkspace | null, index: number): BdtState {
  const t = ws?.tranches[index];
  if (!t || index === 0) return main;
  const f: Record<string, string> = { ...main.f };
  for (const k of Object.keys(f)) if (scopeOf(k) === 'own') delete f[k];
  for (const [k, v] of Object.entries(t.values ?? {})) {
    if (scopeOf(k) === 'deal') continue;
    if (v == null || v === '') delete f[k]; else f[k] = String(v);
  }
  return { ...main, f };
}
