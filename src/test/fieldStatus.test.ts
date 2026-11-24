// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {emptyState} from '@/lib/termsheet/index.js';
import {P,type BdtState} from '@/lib/bdt-bridge';
import {selectTemplate,withExpected,confirmExpected,transitionField,externalState,pricingCompleteness,templatePaths,metadataKey} from '@/lib/fieldStatus';
import {buildMsgText} from '@/lib/msgFormat';
import {trancheBdtState} from '@/lib/trancheState';
import {fromLegacy} from '@/lib/dealWorkspace';
const base=()=>({...emptyState(),fieldMeta:{}} as BdtState);
describe('Reviewed document templates',()=>{
 it('selects fixed-rate from a parsed fixed document',()=>expect(selectTemplate('EUR 500m fixed rate notes 3.125%')).toBe('fixed'));
 it('selects FRN from a parsed floating document',()=>expect(selectTemplate('10Y FRN 3m EURIBOR + 95bp')).toBe('floating'));
 it('selects zero coupon from a parsed discount document',()=>expect(selectTemplate('USD zero-coupon notes issued at a discount')).toBe('zero'));
 it('zero coupon excludes fixed/floating interest fields',()=>{const paths=templatePaths('zero');expect(paths).not.toContain(P.coupon);expect(paths.some(p=>p.includes('FloatingRatePayment'))).toBe(false);});
});
describe('Field certainty',()=>{
 it('confirm changes Expected to Set, preserving source and approver',()=>{const s=base();s.f[P.currency]='EUR';s.f[P.interestType]='FIXED';const expected=withExpected(s);expect(expected.fieldMeta?.[P.dayCount].status).toBe('expected');expect(expected.f[P.dayCount]).toBeUndefined();const confirmed=confirmExpected(expected,P.dayCount,'human');expect(confirmed.f[P.dayCount]).toBe('ICMA_ACT/ACT');expect(confirmed.fieldMeta?.[P.dayCount].status).toBe('set');expect(confirmed.fieldMeta?.[P.dayCount].by).toBe('human');});
 it('approved coupon changes Open to Set with command provenance',()=>{const s=transitionField(base(),P.coupon,'3.125','approver','Co-Pilot command: Price at coupon 3.125%');expect(s.fieldMeta?.[P.coupon].status).toBe('set');expect(s.fieldMeta?.[P.coupon].by).toBe('approver');expect(s.f[P.coupon]).toBe('3.125');});
 it('interim guidance stays Open and keeps latest/history',()=>{let s=transitionField(base(),P.guidance,'MS+95 area','human','Co-Pilot command');s=transitionField(s,P.guidance,'MS+88 area','human','Co-Pilot command');expect(s.fieldMeta?.[P.guidance].status).toBe('open');expect(s.fieldMeta?.[P.guidance].latest).toBe(true);expect(s.fieldMeta?.[P.guidance].history?.[0].value).toBe('MS+95 area');});
 it('MSG never includes an Expected coupon or denomination even if present in imported f',()=>{const s=base();s.f[P.coupon]='9.875';s.f[P.denomination]='123456';for(const p of [P.coupon,P.denomination])s.fieldMeta={...s.fieldMeta,[p]:{status:'expected',source:'test',by:'',at:''}};const msg=buildMsgText({state:s,borrower:'Example issuer',event:'pricing'});expect(msg).not.toContain('9.875');expect(msg).not.toContain('123456');expect(externalState(s).f[P.coupon]).toBeUndefined();});
 it('per-tranche Expected overrides inherited Set without leaking into MSG',()=>{const s=base(),ws=fromLegacy(null,'EUR',500000000);ws.tranches.push({...ws.tranches[0],id:'b',label:'B',values:{[P.coupon]:'9.875'}});s.fieldMeta={[metadataKey(P.coupon,'b')]:{status:'expected',source:'test',by:'',at:''}};expect(trancheBdtState(s,ws,1).fieldMeta?.[P.coupon].status).toBe('expected');expect(buildMsgText({state:s,ws,borrower:'Example',event:'pricing'})).not.toContain('9.875');});
 it('Priced completeness flags Expected day count and Open coupon only at pricing',()=>{const s=base();s.f[P.currency]='EUR';s.f[P.interestType]='FIXED';const e=withExpected(s);expect(pricingCompleteness(e)).toEqual([]);e.stage=5;expect(pricingCompleteness(e).some(c=>c.d===P.dayCount&&c.t.includes('Expected'))).toBe(true);expect(pricingCompleteness(e).some(c=>c.d===P.coupon&&c.t.includes('Open'))).toBe(true);});
 it('complete zero-coupon template has no incomplete pricing findings',()=>{let s=base();s.f[P.interestType]='ZERO';for(const p of templatePaths('zero'))s=transitionField(s,p,'recorded','human');s.stage=5;expect(pricingCompleteness(s)).toEqual([]);});
});
