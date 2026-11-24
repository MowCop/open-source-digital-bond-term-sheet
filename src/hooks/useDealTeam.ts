import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Signoff } from '@/lib/dealPhase';
import type { UserRole } from '@/types/bond';
export interface TeamMember { user_id: string; role: UserRole; name: string; organization: string }
export function useDealTeam(dealId: string) {
  const [team, setTeam] = useState<TeamMember[]>([]), [signoffs, setSignoffs] = useState<Signoff[]>([]), [docs, setDocs] = useState(0), [error, setError] = useState('');
  const load = useCallback(async () => {
    const [t,s,d] = await Promise.all([supabase.rpc('deal_team_directory',{_deal:dealId}),supabase.from('deal_signoffs').select('*').eq('deal_id',dealId),supabase.from('deal_documents').select('id',{count:'exact',head:true}).eq('deal_id',dealId)]);
    const err=t.error??s.error??d.error; if(err){setError(err.message);return;}
    setError(''); setTeam((t.data??[]).map(x=>({...x,role:x.role as UserRole,name:x.name??'Deal member',organization:x.organization??''})));setSignoffs((s.data??[]) as Signoff[]);setDocs(d.count??0);
  },[dealId]);
  useEffect(()=>{void load();const c=supabase.channel(`team-${dealId}`).on('postgres_changes',{event:'*',schema:'public',table:'deal_signoffs',filter:`deal_id=eq.${dealId}`},()=>void load()).on('postgres_changes',{event:'*',schema:'public',table:'deal_team_members',filter:`deal_id=eq.${dealId}`},()=>void load()).on('postgres_changes',{event:'*',schema:'public',table:'deal_documents',filter:`deal_id=eq.${dealId}`},()=>void load()).subscribe();return()=>{void supabase.removeChannel(c);};},[dealId,load]);
  return {team,signoffs,docs,error,reload:load};
}