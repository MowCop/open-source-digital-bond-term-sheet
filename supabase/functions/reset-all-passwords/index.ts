import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_EMAIL = "karl.mallalieu@gmail.com";
const NEW_PASSWORD = "28March2028!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: { email: string; ok: boolean; error?: string }[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data.users ?? [];
      for (const u of users) {
        const email = (u.email || "").toLowerCase();
        if (!email || email === MASTER_EMAIL) continue;
        const { error: updErr } = await admin.auth.admin.updateUserById(u.id, { password: NEW_PASSWORD });
        results.push({ email, ok: !updErr, error: updErr?.message });
      }
      if (users.length < perPage) break;
      page++;
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});