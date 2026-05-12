import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory brute-force throttle (best-effort, per warm instance).
const attempts = new Map<string, { count: number; firstAt: number; blockUntil: number }>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;
function checkThrottle(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.blockUntil > now) return { ok: false, retryAfter: Math.ceil((rec.blockUntil - now) / 1000) };
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 0, firstAt: now, blockUntil: 0 });
  }
  return { ok: true };
}
function recordFailure(key: string) {
  const now = Date.now();
  const rec = attempts.get(key) ?? { count: 0, firstAt: now, blockUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.blockUntil = now + BLOCK_MS;
  attempts.set(key, rec);
}
function recordSuccess(key: string) { attempts.delete(key); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, passcode } = await req.json();
    if (!email || !passcode) {
      return new Response(JSON.stringify({ ok: false, error: 'Email and passcode required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const normalizedEmailKey = String(email).trim().toLowerCase();
    const throttleKey = `${ip}:${normalizedEmailKey}`;
    const throttle = checkThrottle(throttleKey);
    if (!throttle.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Too many attempts. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(throttle.retryAfter ?? 900) },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const normalizedEmail = normalizedEmailKey;
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
      recordFailure(throttleKey);
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email or passcode' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    recordSuccess(throttleKey);

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