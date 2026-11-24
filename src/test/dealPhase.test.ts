// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dealPhase, executionReadiness, executionGateState, mayEditField, STRUCTURE_PATHS, type Signoff, type SignoffItem } from '@/lib/dealPhase';
import { unifiedChecks } from '@/lib/bdt-bridge';
const definition=readFileSync(new URL('../../drizzle/migrations/0016_signoff_notice_and_closed_coverage.sql',import.meta.url),'utf8').match(/SELECT '(\[[\s\S]*?\])'::jsonb/);
if(!definition)throw new Error('Missing shared checklist definition');
const CHECKLIST:SignoffItem[]=JSON.parse(definition[1]);
const team=[{role:'dcm'},{role:'issuer_legal'},{role:'counsel'}];
const readiness=(checks:{l:'warn'|'fail'}[],signs:Signoff[],evidence:Record<string,boolean>,dirty=false)=>executionReadiness(checks,signs,evidence,dirty,team,CHECKLIST);
describe('Stage-derived deal phases',()=>{
  it('Mandate and Announced before IPTs are set-up',()=>{expect(dealPhase({stage:'Mandate'})).toBe('setup');expect(dealPhase({stage:'Announced'})).toBe('setup');});
  it('saved IPT stage and IPT values start execution without a new lifecycle stage',()=>{expect(dealPhase({stage:'Announced',bdtState:{stage:2}})).toBe('execution');expect(dealPhase({stage:'Announced',bdtState:{f:{'x:iptSpread':'MS + 100'}}})).toBe('execution');});
  it.each(['Books Open','Launched','Books Closed','Priced'] as const)('%s is execution',stage=>expect(dealPhase({stage})).toBe('execution'));
  it('Settled always wins over IPT values and is closed',()=>expect(dealPhase({stage:'Settled',bdtState:{stage:2}})).toBe('closed'));
});
describe('Execution readiness',()=>{
 it('incomplete existing records still yield blocking checks without inventing data',()=>{const state=executionGateState({stage:1,f:{},parties:[]});expect(unifiedChecks(state).some(c=>c.l==='fail')).toBe(true);expect(state.f).toEqual({});expect(state.docs).toEqual([]);expect(state.parties).toEqual([]);});
 const evidence=Object.fromEntries(CHECKLIST.map(i=>[i.key,true]));
 const signs:Signoff[]=CHECKLIST.map(i=>({item_key:i.key,role:i.role,user_id:'actor',status:'signed_off',updated_at:'2026-11-24T09:54:00Z'}));
 it('all 12 actor sign-offs and no blocking issues are required with a full team',()=>{expect(readiness([{l:'warn'}],signs,evidence).ready).toBe(true);expect(readiness([],signs.slice(1),evidence).ready).toBe(false);expect(readiness([{l:'fail'}],signs,evidence).ready).toBe(false);});
 it('recorded evidence and saved terms are required despite signed-off status',()=>{expect(readiness([],signs,{...evidence,issuer:false}).ready).toBe(false);expect(readiness([],signs,evidence,true).ready).toBe(false);});
 it('a sign-off by the wrong role never completes an item',()=>expect(readiness([],signs.map(s=>s.item_key==='issuer'?{...s,role:'dcm'}:s),evidence).ready).toBe(false));
 it('only the four DCM items are required when only DCM is assigned',()=>{const r=executionReadiness([],signs.filter(s=>s.role==='dcm'),{structure:true,size:true,tenor:true,bookrunners:true},false,[{role:'dcm'}],CHECKLIST);expect(r.ready).toBe(true);expect(r.outstanding).toEqual([]);});
 it('unassigned actors require no sign-offs but blocking checks still prevent a normal move',()=>{expect(executionReadiness([],[],{},false,[],CHECKLIST).ready).toBe(true);expect(executionReadiness([{l:'fail'}],[],{},false,[],CHECKLIST).ready).toBe(false);});
});
describe('Actor field permissions',()=>{
 it.each(['issuer_legal','counsel'] as const)('%s edits only in set-up',role=>{expect(mayEditField(role,'setup','coupon')).toBe(true);expect(mayEditField(role,'execution','coupon')).toBe(false);});
 it('DCM edits structure and bookrunners, not pricing or legal terms',()=>{for(const p of STRUCTURE_PATHS)expect(mayEditField('dcm','execution',p)).toBe(true);expect(mayEditField('dcm','execution','group:parties')).toBe(true);expect(mayEditField('dcm','execution','x:guidance')).toBe(false);});
 it.each(['master_admin','syndicate_admin','dcm','issuer_legal','counsel','vendor_user'] as const)('Closed is read-only for %s',role=>expect(mayEditField(role,'closed',STRUCTURE_PATHS[0])).toBe(false));
});