// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dealPhase, executionGateState, mayEditField, STRUCTURE_PATHS } from '@/lib/dealPhase';
import { unifiedChecks } from '@/lib/bdt-bridge';
describe('Stage-derived deal phases',()=>{
  it('Mandate and Announced before IPTs are set-up',()=>{expect(dealPhase({stage:'Mandate'})).toBe('setup');expect(dealPhase({stage:'Announced'})).toBe('setup');});
  it('saved IPT stage and IPT values start execution without a new lifecycle stage',()=>{expect(dealPhase({stage:'Announced',bdtState:{stage:2}})).toBe('execution');expect(dealPhase({stage:'Announced',bdtState:{f:{'x:iptSpread':'MS + 100'}}})).toBe('execution');});
  it.each(['Books Open','Launched','Books Closed','Priced'] as const)('%s is execution',stage=>expect(dealPhase({stage})).toBe('execution'));
  it('Settled always wins over IPT values and is closed',()=>expect(dealPhase({stage:'Settled',bdtState:{stage:2}})).toBe('closed'));
});
describe('Actor field permissions',()=>{
 it.each(['issuer_legal','counsel'] as const)('%s edits only in set-up',role=>{expect(mayEditField(role,'setup','coupon')).toBe(true);expect(mayEditField(role,'execution','coupon')).toBe(false);});
 it('DCM edits structure and bookrunners, not pricing or legal terms',()=>{for(const p of STRUCTURE_PATHS)expect(mayEditField('dcm','execution',p)).toBe(true);expect(mayEditField('dcm','execution','group:parties')).toBe(true);expect(mayEditField('dcm','execution','x:guidance')).toBe(false);});
 it.each(['master_admin','syndicate_admin','dcm','issuer_legal','counsel','vendor_user'] as const)('Closed is read-only for %s',role=>expect(mayEditField(role,'closed',STRUCTURE_PATHS[0])).toBe(false));
});