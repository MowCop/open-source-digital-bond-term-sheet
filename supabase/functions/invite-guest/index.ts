import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generatePasscode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit confusing chars
  const max = 256 - (256 % alphabet.length); // rejection sampling to avoid modulo bias
  const out: string[] = [];
  const buf = new Uint8Array(1);
  while (out.length < 8) {
    crypto.getRandomValues(buf);
    if (buf[0] < max) out.push(alphabet[buf[0] % alphabet.length]);
  }
  const s = out.join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabaseUser.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is an admin
    const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roleRows ?? []).some((r: any) => r.role === 'master_admin' || r.role === 'syndicate_admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, name, dealIds, expiresInDays, regeneratePasscodeId } = await req.json();

    if (regeneratePasscodeId) {
      // Ownership check: syndicate admins can only regenerate their own passcodes
      const isMaster = (roleRows ?? []).some((r: any) => r.role === 'master_admin');
      const { data: existing, error: existingErr } = await supabase
        .from('guest_passcodes')
        .select('created_by')
        .eq('id', regeneratePasscodeId)
        .single();
      if (existingErr || !existing) {
        return new Response(JSON.stringify({ error: 'Passcode not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!isMaster && existing.created_by !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const newCode = generatePasscode();
      const { data, error } = await supabase
        .from('guest_passcodes')
        .update({ passcode: newCode })
        .eq('id', regeneratePasscodeId)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, passcode: newCode, record: data }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email || !Array.isArray(dealIds) || dealIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Email and at least one deal are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const passcode = generatePasscode();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('guest_passcodes')
      .insert({
        email: String(email).trim(),
        name: name || null,
        passcode,
        deal_ids: dealIds,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (error) throw error;

    // Audit
    await supabase.from('audit_log').insert({
      id: crypto.randomUUID(),
      action: 'guest_invite_created',
      entity_type: 'user',
      entity_id: data.id,
      user_id: user.id,
      details: `Invited guest ${email} to ${dealIds.length} deal(s).`,
    });

    // Email is logged for now — wire to transactional email when domain is set up
    console.log(`[invite-guest] Email to ${email}: passcode ${passcode}, deals ${dealIds.join(',')}`);

    return new Response(JSON.stringify({ ok: true, passcode, record: data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});