import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUTHOR_EMAIL = 'karl@eurobondmarkets.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, name, organization, userId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Always: write an audit log entry the author can see in-app under "Audit Log"
    await supabase.from('audit_log').insert({
      id: crypto.randomUUID(),
      action: 'signup_pending_review',
      entity_type: 'user',
      entity_id: userId || email,
      user_id: userId || `signup:${email}`,
      details: `New signup pending review — ${name} (${email}) from ${organization || 'unknown org'}. Notify ${AUTHOR_EMAIL}.`,
    });

    // Send branded notification email via the transactional email pipeline.
    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'signup-notification',
          recipientEmail: AUTHOR_EMAIL,
          idempotencyKey: `signup-${userId || email}`,
          templateData: {
            name,
            email,
            organization,
            signedUpAt: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.log('[notify-author-on-signup] transactional email send failed', e);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});