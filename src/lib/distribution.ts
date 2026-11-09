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

export interface OrgAlertSettings { provider: 'resend' | 'microsoft_graph' | 'gmail'; syndicate_mailbox: string }
export async function loadOrgAlertSettings(): Promise<OrgAlertSettings> {
  const org = await myOrg();
  const { data } = await supabase.from('org_alert_settings').select('provider,syndicate_mailbox').eq('org', org).maybeSingle();
  return { provider: (data?.provider ?? 'resend') as OrgAlertSettings['provider'], syndicate_mailbox: data?.syndicate_mailbox ?? '' };
}
export async function saveOrgAlertSettings(s: OrgAlertSettings) {
  const mailbox = s.syndicate_mailbox.trim().toLowerCase();
  if (mailbox && !parseAddresses([mailbox]).addresses.length) throw new Error('Syndicate mailbox is not a valid email.');
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('org_alert_settings').upsert({ org: await myOrg(), provider: s.provider, syndicate_mailbox: mailbox || null, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'org' });
  if (error) throw error;
}
export interface AlertStatus { provider: OrgAlertSettings['provider']; syndicateMailbox: string; resendVerified: boolean; graphConnected: boolean; sender: { name: string; email: string; org: string } }
export async function loadAlertStatus(): Promise<AlertStatus | null> {
  const { data, error } = await supabase.functions.invoke('send-deal-alert', { body: { action: 'status' } });
  return error ? null : (data as AlertStatus);
}

export async function setDistributionEnabled(vendorId: string, enabled: boolean) {
  const { error } = await supabase.from('vendor_distribution').update({ enabled, updated_at: new Date().toISOString() }).eq('vendor_id', vendorId).eq('org', await myOrg());
  if (error) throw error;
}
