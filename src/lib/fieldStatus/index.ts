import type { BdtState, CheckItem } from '../bdt-bridge';
import { FIELDS } from '../termsheet/index.js';
import { trancheFields } from '../trancheFields';
import type { RateType } from '../dealWorkspace';

export type FieldStatus = 'set' | 'expected' | 'open';
export interface FieldRecord { status: FieldStatus; source: string; by: string; at: string; suggestion?: string; why?: string; latest?: boolean; history?: { value: string; source: string; by: string; at: string }[] }
export type FieldMetadata = Record<string, FieldRecord>;
export const metadataKey = (path: string, tranche?: string) => tranche ? `tranche:${tranche}:${path}` : path;
export const interimField = (p: string) => /^x:(iptSpread|guidance|bookSize|booksOpen|booksExJLM|priceTalk|yieldTalk|sizeMsg|sizeIndication|sizeSkew)$/.test(p);
/** Mini timeline: prior values (oldest first) followed by the current value. */
export function evolution(state: Pick<BdtState,'f'|'fieldMeta'>, path: string, tranche?: string) { const r=fieldRecord(state,path,tranche); return [...(r.history??[]).map(h=>({value:String(h.value),by:h.by,at:h.at,source:h.source})), ...(state.f[path]?[{value:state.f[path],by:r.by,at:r.at,source:r.source}]:[])]; }
export function fieldRecord(state: Pick<BdtState,'f'|'fieldMeta'>, path: string, tranche?: string): FieldRecord {
  const grouped=path.match(/^(parties|ids|ratings|docs|contacts)\.(\d+)\.(.+)$/);
  const groupValue=grouped?(state as unknown as Record<string,Record<string,unknown>[]>)[grouped[1]]?.[Number(grouped[2])]?.[grouped[3]]:null;
  const value=grouped?String(groupValue??''):state.f[path];
  const inherited=grouped?state.fieldMeta?.[`group:${grouped[1]}`]:undefined;
  return state.fieldMeta?.[metadataKey(path,tranche)] ?? (value&&inherited?inherited:undefined) ?? {status: value?.trim() ? (interimField(path) ? 'open' : 'set') : 'open', source: value?.trim() ? 'Previously recorded DTS' : '', by:'',at:'', latest: !!value?.trim() && interimField(path)};
}
export function fixedAt(p: string) { return /Coupon|InterestRate|IssuePrice|Reoffer|Yield|Spread\/Value|priceTalk|yieldTalk/.test(p) ? 'Fixed at pricing' : /ISIN|ids/.test(p) ? 'Fixed before settlement' : /Maturity|tenor|Amount|InterestType|tranches|sizeMsg|sizeIndication|sizeSkew|usdEquivalent/.test(p) ? 'Fixed at launch / pricing' : interimField(p) ? 'Latest execution update' : 'Confirm during documentation'; }
export function transitionField(state: BdtState,path: string,value: string,actor: string,source='Manual',confirm=false,tranche?: string): BdtState {
  const key=metadataKey(path,tranche), before=fieldRecord(state,path,tranche),at=new Date().toISOString();
  const record:FieldRecord={status: value ? (interimField(path)&&!confirm?'open':'set'):'open',source,by:actor,at,latest:!!value&&interimField(path),history:[...(before.history??[]),...(state.f[path]? [{value:state.f[path],source:before.source,by:before.by,at:before.at}]:[])].slice(-30)};
  return {...state,f:{...state.f,[path]:value},fieldMeta:{...state.fieldMeta,[key]:record}};
}
export function confirmExpected(state:BdtState,path:string,actor:string,tranche?:string) { const r=fieldRecord(state,path,tranche);return transitionField(state,path,r.suggestion??state.f[path]??'',actor,r.source||'Manual confirmation',true,tranche); }
export function selectTemplate(text: string, fields:Record<string,string>={}): RateType {
  const type=fields['IssuanceDataGroup/Product/InterestPayment/InterestType']??'';
  if (/ZERO|zero[ -]?coupon|discount notes/i.test(type+' '+text)) return 'zero';
  if (/FLOAT|floating[ -]?rate|\bFRN\b|\b(?:EURIBOR|SOFR|SONIA)\b/i.test(type+' '+text)) return 'floating';
  return 'fixed';
}
export const TEMPLATE_LABELS:Record<RateType,string>={fixed:'Fixed rate',floating:'Floating rate',zero:'Zero coupon'};
export const templatePaths=(rate:RateType)=>trancheFields(rate).map(r=>r.p);
export function withExpected(state:BdtState):BdtState {
  const m={...state.fieldMeta}, f=state.f;
  const add=(p:string,suggestion:string,why:string)=>{if(!f[p]&&!m[p])m[p]={status:'expected',suggestion,why,source:'ICMA BDT 2.0 Appendix C1 / market convention (not a mandated default)',by:'',at:''};};
  const eur=f['IssuanceDataGroup/Issuance/SpecifiedCurrency']==='EUR',rate=f['IssuanceDataGroup/Product/InterestPayment/InterestType'];
  if(eur&&rate==='FIXED')add('IssuanceDataGroup/Product/DayCountFraction','ICMA_ACT/ACT','EUR fixed-rate convention; confirm against the offering terms (Handbook Appendix A5 ICMA Actual/Actual / C1).');
  if(rate==='FLOATING') {if(eur||f['IssuanceDataGroup/Issuance/SpecifiedCurrency']==='USD')add('IssuanceDataGroup/Product/DayCountFraction','ACT/360','EUR / USD floating-rate convention; transaction documentation prevails (Appendix A8 / C1).');add('IssuanceDataGroup/Product/BusinessDayConvention/BusinessDayAdjustment','MODIFIED_FOLLOWING','Floating-rate convention; confirm the adjustment in the offering terms (Appendix A8 / C1).');}
  // Legal elections, listing venue and stabilisation cannot be inferred from currency alone.
  if(eur&&f['IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType']==='EU_MIFIDII_PROF_AND_ECPS')add('IssuanceDataGroup/Issuance/SpecifiedDenomination/Value','100000','Wholesale EUR convention; not a legal default. Confirm minimum/increment against the offering terms (Handbook selling restrictions / C1).');
  return {...state,fieldMeta:m};
}
export function statusCounts(state:BdtState,paths:string[]=templatePaths(selectTemplate('',state.f)),tranche?:string) {return paths.reduce((r,p)=>{r[fieldRecord(state,p,tranche).status]++;return r;},{set:0,expected:0,open:0});}
/** Suggestions live outside f. Defensive filtering protects imported/older metadata too. Interim latest values are explicit human updates, not inferred defaults. */
export function externalState(state:BdtState):BdtState {
 const f={...state.f};for(const p of Object.keys(f)){const r=state.fieldMeta?.[p];if(r&&r.status!=='set'&&!(r.status==='open'&&r.latest))delete f[p];}
 const out={...state,f};for(const g of ['parties','ids','ratings','docs'] as const){const r=state.fieldMeta?.[`group:${g}`];if(r&&r.status!=='set')out[g]=[] as never;}return out;
}
export function pricingCompleteness(state:BdtState):CheckItem[] {
 if(state.stage<5||!state.fieldMeta)return [];
 const rate=state.template??selectTemplate('',state.f);
 return templatePaths(rate).filter(p=>!interimField(p)).filter(p=>fieldRecord(state,p).status!=='set'||!state.f[p]?.trim()).map(p=>({l:'fail' as const,src:'bdt' as const,t:`Pricing term sheet incomplete: ${(FIELDS as {p:string;l:string}[]).find(f=>f.p===p)?.l??p} is still ${fieldRecord(state,p).status === 'expected'?'Expected':'Open'}`,d:p}));
}
