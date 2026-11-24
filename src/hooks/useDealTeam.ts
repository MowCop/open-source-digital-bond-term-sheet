import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/types/bond';
export interface TeamMember { user_id:string; role:UserRole; name:string; organization:string }
export function useDealTeam(dealId:string) {
 const [team,setTeam]=useState<TeamMember[]>([]),[error,setError]=useState('');
 const load=useCallback(async()=>{const {data,error}=await supabase.rpc('deal_team_directory',{_deal:dealId});if(error){setError(error.message);return;}setError('');setTeam((data??[]).map(t=>({...t,role:t.role as UserRole,name:t.name??'Deal member',organization:t.organization??''})));},[dealId]);
 useEffect(()=>{void load();const c=supabase.channel(`team-${dealId}`).on('postgres_changes',{event:'*',schema:'public',table:'deal_team_members',filter:`deal_id=eq.${dealId}`},()=>void load()).subscribe();return()=>{void supabase.removeChannel(c);};},[dealId,load]);
 return {team,error,reload:load};
}
