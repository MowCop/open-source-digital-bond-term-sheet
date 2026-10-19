import { supabase } from '@/integrations/supabase/client';
import { getAiModel } from '@/lib/aiModel';
import { readDocument } from './document-reader';
import { toast } from 'sonner';
import type { LiveCheck } from './liveChecks';
export const COPILOT_CHANGED='vdr:copilot-changed';
export const changed=(id:string)=>window.dispatchEvent(new CustomEvent(COPILOT_CHANGED,{detail:id}));
const flights=new Map<string,Promise<void>>();
const rerun=new Set<string>();
export async function callCopilot(threadId:string,action:'chat'|'process'|'resume',message?:string,liveChecks?:LiveCheck[]){
 const {data,error}=await supabase.functions.invoke('deal-copilot',{body:{threadId,action,message,model:getAiModel(),...(liveChecks?{liveChecks}:{})}});
 if(error){let msg=error.message;try{const b=await(error as {context?:Response}).context?.json();msg=b?.message??msg;}catch{}throw new Error(msg);}changed(threadId);return data;
}
export function processCopilot(id:string):Promise<void>{const f=flights.get(id);if(f){rerun.add(id);return f;}const p=(async()=>{for(let i=0;i<12;i++){rerun.delete(id);const r=await callCopilot(id,'process');if(!r?.completed?.length&&!rerun.has(id))break;}})().finally(()=>{flights.delete(id);rerun.delete(id);});flights.set(id,p);return p;}
export async function reviewSavedDocument(id:string,doc:string,file:File){const text=await readDocument(file);const{error}=await supabase.rpc('copilot_register_document',{_thread:id,_document:doc,_text:text});if(error)throw error;changed(id);await processCopilot(id);}
export async function onCopilotDocumentSaved(deal:string,doc:string,file:File){const{data,error}=await supabase.rpc('copilot_open',{_deal:deal});if(error||!data)return;try{await reviewSavedDocument(data,doc,file);}catch(e){toast.error(`Co-Pilot review: ${file.name}`,{description:e instanceof Error?e.message:'Review failed. Original remains saved.'});changed(data);}}
export async function onCopilotTermsSaved(deal:string){const{data,error}=await supabase.rpc('copilot_review_saved_terms',{_deal:deal});if(error||!data)return;try{await processCopilot(data);}catch(e){toast.error('Automatic Co-Pilot review paused',{description:e instanceof Error?e.message:'Review failed'});changed(data);}}
