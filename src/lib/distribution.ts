import { supabase } from '@/integrations/supabase/client';
import { parseAddresses, type DistributionRow } from '@/lib/newIssueAlerts';

/** Org-level vendor new-issues distribution addresses (backend, RLS by organisation). */
async function myOrg(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return '';
  const { data } = await supabase.from('profiles').select('organization').eq('user_id', u.user.id).maybeSingle();
  return data?.organization ?? '';
}

export async function loadDistribution(): Promise<DistributionRow[]> {
  const { data, error } = await supabase.from('vendor_distribution').select('vendor_id,vendor_name,addresses,enabled');
  if (error) throw error;
  return (data ?? []) as DistributionRow[];
}

export async function saveDistribution(vendorId: string, vendorName: string, raw: string[], enabled?: boolean) {
  const { addresses, invalid } = parseAddresses(raw);
  if (invalid.length) throw new Error(`Not a valid email: ${invalid.join(', ')}`);
  const { data: u } = await supabase.auth.getUser();
  const row: Record<string, unknown> = { org: await myOrg(), vendor_id: vendorId, vendor_name: vendorName, addresses, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() };
  if (enabled !== undefined) row.enabled = enabled;
  const { error } = await supabase.from('vendor_distribution').upsert(row as never, { onConflict: 'org,vendor_id' });
  if (error) throw error;
}

export async function setDistributionEnabled(vendorId: string, enabled: boolean) {
  const { error } = await supabase.from('vendor_distribution').update({ enabled, updated_at: new Date().toISOString() }).eq('vendor_id', vendorId).eq('org', await myOrg());
  if (error) throw error;
}
