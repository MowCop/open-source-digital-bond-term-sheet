import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { unifiedChecks, trancheBdtState, checklistEvidence, executionGateState } from '../_shared/execution-validator.js';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({message:'Method not allowed'},405);
  try{
    const authorization=req.headers.get('Authorization')??'';
    const user=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_ANON_KEY')??'',{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const {data:a,error:authError}=await user.auth.getUser();if(authError||!a.user)return json({message:'Sign in first'},401);
    const {dealId,note,override=false,observedChecks=[]}=await req.json();if(typeof dealId!=='string'||typeof note!=='string'||!note.trim()||note.length>2000||typeof override!=='boolean'||!Array.isArray(observedChecks)||observedChecks.length>100)return json({message:'Deal and audit note required'},400);
    const [{data:d,error},{data:ctx,error:ctxError},{count,error:docError},{data:team,error:teamError},{data:items,error:itemError}]=await Promise.all([user.from('deals').select('bdt_state,deal_workspace').eq('id',dealId).single(),user.rpc('deal_actor_context',{_deal:dealId}),user.from('deal_documents').select('id',{head:true,count:'exact'}).eq('deal_id',dealId),user.from('deal_team_members').select('role').eq('deal_id',dealId),user.rpc('signoff_item_fields')]);
    if(error||!d||!ctx?.roles?.some((r:string)=>['master_admin','syndicate_admin'].includes(r)))return json({message:'Syndicate administrator access required'},403);
    if(ctxError||docError||teamError||itemError||!Array.isArray(items))return json({message:'Could not load the saved readiness requirements'},409);
    if(ctx.phase!=='setup')return json({message:'Deal is no longer in set-up'},409);
    if(!override&&!d.bdt_state?.f)return json({message:'Save the set-up DTS first'},409);
    const state=executionGateState(d.bdt_state);
    const tranches=d.deal_workspace?.tranches;
    const states=(tranches?.length?tranches:[null]).map((_:unknown,i:number)=>trancheBdtState(state,d.deal_workspace,i));
    const blocking=states.flatMap((s:unknown)=>unifiedChecks(s)).filter((c:{l:string})=>c.l==='fail');
    // Browser registry findings are retained as observations, never used to replace server checks.
    blocking.push(...observedChecks.filter(c=>c?.l==='fail'&&['gleif','openfigi'].includes(c.src)&&typeof c.t==='string').map(c=>({l:'fail',t:c.t.slice(0,1000),src:c.src,provenance:'browser_registry_observation'})));
    const evidence=checklistEvidence(state,d.deal_workspace,count??0);
    const openItems=items.filter((i:{key:string;role:string})=>team?.some((t:{role:string})=>t.role===i.role)&&!evidence[i.key]);
    if(!override&&(blocking.length||openItems.length))return json({message:'Complete the required fields and resolve blocking Deal Checker findings before execution',blocking,openItems},409);
    const admin=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',{auth:{persistSession:false}});
    const result=await admin.rpc('move_deal_to_execution',{_deal:dealId,_actor:a.user.id,_expected:d.bdt_state,_workspace:d.deal_workspace,_note:note.trim(),_override:override,_blocking:blocking,_open_items:openItems});
    if(result.error)return json({message:result.error.message},409);
    return json({phase:'execution',stage:'IPTs'});
  }catch{return json({message:'Could not move to execution; refresh the saved terms and try again'},400);}
});