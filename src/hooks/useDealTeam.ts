import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Signoff, SignoffItem, PhaseAudit } from '@/lib/dealPhase';
import type { UserRole } from '@/types/bond';
export interface TeamMember { user_id: string; role: UserRole; name: string; organization: string }
export function useDealTeam(dealId: string) {
  const [team, setTeam] = useState<TeamMember[]>([]), [signoffs, setSignoffs] = useState<Signoff[]>([]), [docs, setDocs] = useState(0), [error, setError] = useState('');
  const [items,setItems]=useState<SignoffItem[]>([]),[audit,setAudit]=useState<PhaseAudit[]>([]),[loaded,setLoaded]=useState(false);
  const load = useCallback(async () => {
    const [t,s,d,i,a] = await Promise.all([supabase.rpc('deal_team_directory',{_deal:dealId}),supabase.from('deal_signoffs').select('*').eq('deal_id',dealId),supabase.from('deal_documents').select('id',{count:'exact',head:true}).eq('deal_id',dealId),supabase.rpc('signoff_item_fields'),supabase.rpc('deal_phase_audit',{_deal:dealId})]);
    const err=t.error??s.error??d.error??i.error??a.error; if(err){setError(err.message);setLoaded(false);return;}
    setItems((i.data??[]) as unknown as SignoffItem[]);setAudit((a.data??[]) as unknown as PhaseAudit[]);setLoaded(true);
    setError(''); setTeam((t.data??[]).map(x=>({...x,role:x.role as UserRole,name:x.name??'Deal member',organization:x.organization??''})));setSignoffs((s.data??[]) as Signoff[]);setDocs(d.count??0);
  },[dealId]);
  useEffect(()=>{setLoaded(false);void load();const c=supabase.channel(`team-${dealId}`).on('postgres_changes',{event:'*',schema:'public',table:'deal_signoffs',filter:`deal_id=eq.${dealId}`},()=>void load()).on('postgres_changes',{event:'*',schema:'public',table:'deal_team_members',filter:`deal_id=eq.${dealId}`},()=>void load()).on('postgres_changes',{event:'*',schema:'public',table:'deal_documents',filter:`deal_id=eq.${dealId}`},()=>void load()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'deals',filter:`id=eq.${dealId}`},()=>void load()).subscribe();return()=>{void supabase.removeChannel(c);};},[dealId,load]);
  return {team,signoffs,docs,items,audit,loaded,error,reload:load};
}