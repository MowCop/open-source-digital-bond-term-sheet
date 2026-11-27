import { FieldStatusSummary } from './termsheet/FieldStatusContext';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MoreHorizontal, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useDealTeam } from '@/hooks/useDealTeam';
import { ACTOR_LABELS, defaultWorkspaceTab, WORKSPACE_TABS, type ActorRole, type DealPhase, type WorkspaceTab } from '@/lib/dealPhase';
import { dealToBdtState, unifiedChecks } from '@/lib/bdt-bridge';
import { getLiveChecks, onLiveChecks } from '@/lib/copilot/liveChecks';
import { trancheBdtState } from '@/lib/trancheState';
import type { DealWorkspace } from '@/lib/dealWorkspace';
import type { Deal } from '@/types/bond';
import LiveMsgPanel from './LiveMsgPanel';
import AiModelPicker from './AiModelPicker';
import UnifiedDealChecker from './termsheet/UnifiedDealChecker';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function DealPhaseWorkspace({deal,phase,children,intake,ws,dirty,onSend,canSend,onEditorOpen,documents,documentDrop}: {documents?:ReactNode;documentDrop?:ReactNode;deal:Deal;phase:DealPhase;children:ReactNode;intake:ReactNode;ws:DealWorkspace|null;dirty:boolean;onSend:()=>void;canSend:boolean;onEditorOpen:(tab?:string)=>void}) {
  const {authUser,roles,isAdmin}=useAuth(),{currentUser}=useApp(),navigate=useNavigate();
  const {team,error,reload}=useDealTeam(deal.id);
  const [full,setFull]=useState(false),[message,setMessage]=useState(true),[mobile,setMobile]=useState<WorkspaceTab>(()=>defaultWorkspaceTab(phase)),[active,setActive]=useState<WorkspaceTab>(()=>defaultWorkspaceTab(phase)),[assign,setAssign]=useState(false),[people,setPeople]=useState<{user_id:string;name:string}[]>([]),[person,setPerson]=useState(''),[actor,setActor]=useState<ActorRole>('dcm'),[busy,setBusy]=useState(false);
  const st=dealToBdtState(deal);
  const [liveChecks,setLiveChecks]=useState(()=>getLiveChecks(deal.id)??[]);
  useEffect(()=>onLiveChecks(id=>{if(id===deal.id)setLiveChecks(getLiveChecks(id)??[]);}),[deal.id]);
  useEffect(()=>{if(!full)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('[role="dialog"]'))setFull(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[full]);
  const checks=useMemo(()=>[...unifiedChecks(st),...(ws?.tranches.slice(1).flatMap((_,i)=>unifiedChecks(trancheBdtState(st,ws,i+1)))??[]),...liveChecks.filter(c=>c.src==='gleif'||c.src==='openfigi')],[deal.bdtState,ws,liveChecks]);
  useEffect(()=>{if(!assign)return;void supabase.from('profiles').select('user_id,name').eq('status','approved').then(({data})=>setPeople((data??[]).map(p=>({user_id:p.user_id,name:p.name??'Deal member'}))));},[assign]);
  const openEditor=(tab?:string)=>{setFull(true);onEditorOpen(tab);};
  return <section className="space-y-3 min-w-0" aria-label="Deal phase workspace">
    {error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
    {phase==='setup'&&<div className="flex items-center gap-2 text-xs text-muted-foreground">{dirty&&<span className="text-warning">Unsaved terms</span>}</div>}
    <header className="flex flex-wrap items-center gap-2 border-b border-border pb-2"><div className="flex gap-1" aria-label="Workspace tabs">{WORKSPACE_TABS.map(t=><Button key={t} size="sm" variant={active===t?'secondary':'ghost'} onClick={()=>{setActive(t);setMobile(t);if(t==='dts')onEditorOpen('sheets');}}>{t==='docs'?'Documents':t==='dts'?'DTS':'Message'}</Button>)}</div><FieldStatusSummary state={st}/><div className="ml-auto flex flex-wrap gap-2">{canSend&&phase!=='closed'&&<Button size="sm" onClick={onSend}>Send update</Button>}
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost" aria-label="More deal tools"><MoreHorizontal className="h-4 w-4"/>More</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>navigate('/bond-console')}>Bond Console</DropdownMenuItem><DropdownMenuItem onSelect={()=>navigate('/audit-log')}>Audit log</DropdownMenuItem><DropdownMenuItem onSelect={()=>openEditor()}>Full DTS & exports</DropdownMenuItem>{isAdmin&&<DropdownMenuItem onSelect={()=>setAssign(true)}>Manage deal team</DropdownMenuItem>}<div className="p-2"><AiModelPicker/></div></DropdownMenuContent></DropdownMenu>
      </div>
    </header>
    <div className={`deal-phase-grid ${phase==='setup'?'deal-setup-grid':'deal-execution-grid'}`}>
      {phase==='setup'?<aside className={`${mobile==='dts'||mobile==='docs'?'':'hidden'} min-w-0 space-y-4`} aria-label="Document intake">{intake}</aside>:null}
      <main className={`min-w-0 ${phase==='setup'&&mobile!=='dts'?'hidden':''}`}>
        <div className={phase==='setup'?(mobile==='dts'?'':'hidden'):(full?'deal-full-editor':(mobile==='dts'?'':'hidden'))}>{phase!=='setup'&&full&&<div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Full DTS</h2><Button size="icon" variant="ghost" aria-label="Close full DTS" onClick={()=>setFull(false)}><X className="h-4 w-4"/></Button></div>}{children}</div>
        {phase!=='setup'&&<div className={full?'hidden':(mobile==='dts'?'hidden':'')}><UnifiedDealChecker state={st} ws={ws} dealId={deal.id} onNavigate={()=>openEditor()}/></div>}
      </main>
      {mobile==='docs'&&phase!=='setup'&&!full&&<div className="min-w-0 space-y-3">{documentDrop}{documents}</div>}
      <aside className={`min-w-0 ${mobile==='message'?'':'hidden'} space-y-4`}>
        <div className="flex items-center justify-end"><Button size="sm" variant="ghost" aria-expanded={message} onClick={()=>setMessage(v=>!v)}>{message?'Collapse':'Expand'}</Button></div>{message&&<LiveMsgPanel deal={deal} canSend={false} onSend={onSend}/>}
        <DealTimeline deal={deal}/>
      </aside>
    </div>
    <Dialog open={assign} onOpenChange={setAssign}><DialogContent><DialogHeader><DialogTitle>Deal team</DialogTitle></DialogHeader><Select value={person} onValueChange={setPerson}><SelectTrigger aria-label="Team member"><SelectValue placeholder="Select person"/></SelectTrigger><SelectContent>{people.map(p=><SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}</SelectContent></Select><Select value={actor} onValueChange={v=>setActor(v as ActorRole)}><SelectTrigger aria-label="Team role"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(ACTOR_LABELS).map(([r,l])=><SelectItem key={r} value={r}>{l}</SelectItem>)}</SelectContent></Select><Button disabled={!person||busy} onClick={async()=>{setBusy(true);const {error}=await supabase.rpc('assign_deal_actor',{_deal:deal.id,_user:person,_role:actor});setBusy(false);if(error)toast.error(error.message);else {await reload();setPerson('');}}}>Add to deal</Button>{team.map(t=><div key={`${t.user_id}-${t.role}`} className="flex items-center justify-between text-sm"><span>{t.name} · {t.role==='syndicate_admin'?'Syndicate':ACTOR_LABELS[t.role as ActorRole]}</span><Button variant="ghost" size="icon" aria-label={`Remove ${t.name}`} onClick={async()=>{const{error}=await supabase.from('deal_team_members').delete().eq('deal_id',deal.id).eq('user_id',t.user_id).eq('role',t.role as never);if(error)toast.error(error.message);else await reload();}}><X className="h-4 w-4"/></Button></div>)}</DialogContent></Dialog>
  </section>;
}
function DealTimeline({deal}:{deal:Deal}) {
  const [sends,setSends]=useState<{id:string;created_at:string;status:string}[]>([]);
  useEffect(()=>{const load=()=>void supabase.from('alert_sends').select('id,created_at,alert_send_chunks(status)').eq('deal_id',deal.id).order('created_at',{ascending:false}).limit(10).then(({data})=>setSends((data??[]).map(s=>({id:s.id,created_at:s.created_at,status:s.alert_send_chunks.map(c=>c.status).join(' / ')||'pending'}))));load();const c=supabase.channel(`timeline-${deal.id}`).on('postgres_changes',{event:'*',schema:'public',table:'alert_send_chunks'},load).subscribe();return()=>{void supabase.removeChannel(c);};},[deal.id]);
  const events=[...deal.stageHistory.map((s,i)=>({id:`stage-${i}`,time:new Date(s.timestamp).toISOString(),label:`${s.from} → ${s.to}`,note:s.note})),...sends.map(s=>({id:s.id,time:s.created_at,label:`Send · ${s.status}`,note:''}))].sort((a,b)=>b.time.localeCompare(a.time));
  return <section className="border-t border-border pt-3 text-xs space-y-2" aria-label="Deal timeline"><h3 className="font-semibold">Timeline</h3>{!events.length&&<p className="text-muted-foreground">No stage changes or sends</p>}{events.map(e=><div key={e.id}><p>{e.label}</p><p className="text-muted-foreground">{new Date(e.time).toLocaleString('en-GB',{timeZone:'UTC'})} UTC{e.note&&` · ${e.note}`}</p></div>)}</section>;
}