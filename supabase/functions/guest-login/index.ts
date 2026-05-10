import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, passcode } = await req.json();
    if (!email || !passcode) {
      return new Response(JSON.stringify({ ok: false, error: 'Email and passcode required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPasscode = String(passcode).trim().toUpperCase();

    const { data: rows, error } = await supabase
      .from('guest_passcodes')
      .select('*')
      .eq('passcode', normalizedPasscode)
      .is('revoked_at', null);

    if (error) throw error;

    const match = (rows ?? []).find((r: any) =>
      String(r.email).trim().toLowerCase() === normalizedEmail &&
      (!r.expires_at || new Date(r.expires_at) > new Date())
    );

    if (!match) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email or passcode' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update last_used_at + audit log
    await supabase.from('guest_passcodes').update({ last_used_at: new Date().toISOString() }).eq('id', match.id);
    await supabase.from('audit_log').insert({
      id: crypto.randomUUID(),
      action: 'guest_login',
      entity_type: 'user',
      entity_id: match.id,
      user_id: `guest:${normalizedEmail}`,
      details: `Guest ${normalizedEmail} accessed deals: ${(match.deal_ids || []).join(', ')}`,
    });

    return new Response(JSON.stringify({
      ok: true,
      passcodeId: match.id,
      email: match.email,
      name: match.name,
      dealIds: match.deal_ids || [],
      expiresAt: match.expires_at,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});