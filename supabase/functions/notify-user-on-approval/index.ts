import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify caller is an admin (master_admin or syndicate_admin)
    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles').select('role').eq('user_id', callerId);
    if (roleErr) {
      return new Response(JSON.stringify({ ok: false, error: roleErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes('master_admin') && !roles.includes('syndicate_admin')) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const role = typeof body?.role === 'string' ? body.role : undefined;
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: 'userId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the approved user's profile
    const { data: profile, error: profErr } = await admin
      .from('profiles').select('email, name').eq('user_id', userId).maybeSingle();
    if (profErr || !profile?.email) {
      return new Response(JSON.stringify({ ok: false, error: 'Profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const loginUrl = 'https://eurobondmarkets.com/auth';

    // Send the branded approval email (best effort, but report failure)
    const { error: invokeErr } = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'account-approved',
        recipientEmail: profile.email,
        idempotencyKey: `approval-${userId}`,
        templateData: {
          name: profile.name || 'there',
          role,
          loginUrl,
        },
      },
    });

    // Audit log entry
    await admin.from('audit_log').insert({
      id: crypto.randomUUID(),
      action: invokeErr ? 'USER_APPROVED_EMAIL_FAILED' : 'USER_APPROVED_EMAIL_SENT',
      entity_type: 'user',
      entity_id: userId,
      user_id: callerId,
      details: invokeErr
        ? `Approval email failed for ${profile.email}: ${invokeErr.message}`
        : `Approval email queued for ${profile.email}${role ? ` (role: ${role})` : ''}`,
    });

    if (invokeErr) {
      return new Response(JSON.stringify({ ok: false, error: invokeErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
