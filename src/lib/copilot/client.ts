import { supabase } from '@/integrations/supabase/client';
import { getAiModel } from '@/lib/aiModel';
import { readDocument } from './document-reader';
import { toast } from 'sonner';
import { getLiveChecks, liveChecksVersion, waitForFreshChecks, type LiveCheck } from './liveChecks';
export const COPILOT_CHANGED='vdr:copilot-changed';
export const changed=(id:string)=>window.dispatchEvent(new CustomEvent(COPILOT_CHANGED,{detail:id}));
const flights=new Map<string,Promise<void>>();
const rerun=new Set<string>();
// AI blocked (credit cap / no credits): pause automatic reviews this session instead of retrying.
let aiBlocked='';
export const copilotAiBlocked=()=>aiBlocked;
export async function callCopilot(threadId:string,action:'chat'|'process'|'resume',message?:string,liveChecks?:LiveCheck[],focus?:string){
 // 'chat' and 'resume' always try the backend: a successful call clears the pause,
 // so Resume reviews works again after the workspace limit is raised.
 if(aiBlocked&&action==='process')throw new Error(aiBlocked);
 const {data,error}=await supabase.functions.invoke('deal-copilot',{body:{threadId,action,message,model:getAiModel(),...(liveChecks?{liveChecks}:{}),...(focus?{focus}:{})}});
 if(error){let msg=error.message;try{const b=await(error as {context?:Response}).context?.json();msg=b?.message??msg;}catch{}const st=(error as {context?:Response}).context?.status;if(st===402||st===403&&/credit|limit/i.test(msg)){aiBlocked='Co-Pilot AI is paused: the workspace AI credit limit has been reached. A workspace admin can raise the limit or add credits, then try again.';throw new Error(aiBlocked);}throw new Error(msg);}aiBlocked='';changed(threadId);return data;
}
export function processCopilot(id:string,liveChecks?:LiveCheck[]):Promise<void>{const f=flights.get(id);if(f){rerun.add(id);return f;}const p=(async()=>{for(let i=0;i<12;i++){rerun.delete(id);const r=await callCopilot(id,'process',undefined,liveChecks);if(!r?.completed?.length&&!rerun.has(id))break;}})().finally(()=>{flights.delete(id);rerun.delete(id);});flights.set(id,p);return p;}
export async function reviewSavedDocument(id:string,doc:string,file:File,live?:LiveCheck[]){const text=await readDocument(file);const{error}=await supabase.rpc('copilot_register_document',{_thread:id,_document:doc,_text:text});if(error)throw error;changed(id);await processCopilot(id,live);}
// Only reviewable types go to Co-Pilot; others (e.g. BDT XML) are saved and ingested elsewhere without a review.
export const isCopilotReviewable=(name:string)=>/\.(pdf|docx|txt|md|csv)$/i.test(name);
export async function onCopilotDocumentSaved(deal:string,doc:string,file:File){if(!isCopilotReviewable(file.name))return;const{data,error}=await supabase.rpc('copilot_open',{_deal:deal});if(error||!data)return;let text:string;try{text=await readDocument(file);}catch(e){toast.info(`Co-Pilot skipped ${file.name}`,{description:`${e instanceof Error?e.message:'Not readable.'} The file is saved.`});return;}try{const{error:e2}=await supabase.rpc('copilot_register_document',{_thread:data,_document:doc,_text:text});if(e2)throw e2;changed(data);await processCopilot(data,getLiveChecks(deal));}catch(e){toast.error(`Co-Pilot review: ${file.name}`,{description:e instanceof Error?e.message:'Review failed. Original remains saved.'});changed(data);}}
export async function onCopilotTermsSaved(deal:string){const since=liveChecksVersion(deal);const{data,error}=await supabase.rpc('copilot_review_saved_terms',{_deal:deal});if(error||!data)return;try{const{checks}=await waitForFreshChecks(deal,since);await processCopilot(data,checks);}catch(e){toast.error('Automatic Co-Pilot review paused',{description:e instanceof Error?e.message:'Review failed'});changed(data);}}
