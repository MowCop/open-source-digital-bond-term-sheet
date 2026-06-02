import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * extract-deal-from-chat
 * ─────────────────────────────────────────────────────────────────────────────
 * Input  : {
 *   text: string,                       // full thread/channel transcript
 *   conversationLabel?: string,         // e.g. thread subject / channel label
 *   existingDeals: Array<{
 *     id: string, issuerName: string, currency?: string, size?: string,
 *     tenor?: string, stage?: string, isin?: string,
 *   }>,
 * }
 * Output : {
 *   mode: 'new_deal' | 'update_existing',
 *   matchedDealId?: string,
 *   matchReason?: string,
 *   confidence: number,                 // 0..1
 *   keyTerms: Record<string,string>,    // same shape as extract-deal-fields-ai
 *   bookrunners: Bookrunner[],
 *   suggestedStage?: DealStage,
 *   alerts: string[],                   // lifecycle events observed in chat
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STAGES = ['Mandate','Announced','Launched','Books Open','Books Closed','Priced','Settled'] as const;

const SYSTEM_PROMPT = `You are a fixed-income syndicate analyst reading a chat conversation between bank syndicate desks, sales, and investors discussing a primary bond new-issue.

Your job:
1. Decide whether the chat refers to an EXISTING deal (from the list provided in the user message) or describes a NEW deal that is not in the list.
2. Extract every bond term you can find from the conversation.
3. Identify the current lifecycle stage and list any lifecycle events mentioned.

Return STRICT JSON matching this TypeScript type — no markdown, no commentary:

{
  "mode": "new_deal" | "update_existing",
  "matchedDealId": string,              // REQUIRED when mode = "update_existing"; "" otherwise
  "matchReason": string,                // 1 short sentence explaining the match (or why a new deal)
  "confidence": number,                 // 0..1, your confidence in the mode + match
  "keyTerms": {
    "Issuer Name": string,              // legal borrower name only, never a bookrunner
    "Currency": string,                 // ISO code
    "Size": string,                     // e.g. "500m", "1bn"
    "Tenor": string,                    // e.g. "5Y", "Due 2030"
    "Reoffer Spread": string,           // e.g. "MS+85"
    "Issuer Rating": string,
    "ISIN": string,
    "LEI": string,
    "Coupon": string,
    "Issue Price": string,
    "Reoffer Price": string,
    "Reoffer Yield": string,
    "Mid-Swap Rate": string,
    "Pricing Date": string,
    "Settlement Date": string,
    "Maturity Date": string,
    "Denomination": string,
    "Governing Law": string,            // "English Law" | "New York Law" | "German Law" | "French Law" | "Swiss Law"
    "Listing": string,
    "Day Count": string,
    "Interest Type": string             // "Fixed" | "Floating" | "Zero Coupon"
  },
  "bookrunners": [
    { "name": string, "role": "active" | "passive", "isGlobalCoordinator": boolean }
  ],
  "suggestedStage": "" | "Mandate" | "Announced" | "Launched" | "Books Open" | "Books Closed" | "Priced" | "Settled",
  "alerts": string[]                    // short bullets of lifecycle events found, e.g. "Books opened at MS+90 area", "Priced at MS+72 on 12 Jun"
}

Rules:
- If a field is not present, return an EMPTY STRING "" (never null, never a guess).
- Match to an existing deal ONLY if issuer + currency + size/tenor or ISIN make it clearly the same trade. Otherwise return "new_deal".
- Never put a bank name in "Issuer Name".
- Preserve the document's own date format.
- Do not invent ISINs, LEIs or ratings.
- alerts must be concise factual observations, max ~10 items.`;

const EMPTY_KEY_TERMS: Record<string,string> = {
  'Issuer Name': '', Currency: '', Size: '', Tenor: '',
  'Reoffer Spread': '', 'Issuer Rating': '', ISIN: '', LEI: '',
  Coupon: '', 'Issue Price': '', 'Reoffer Price': '', 'Reoffer Yield': '',
  'Mid-Swap Rate': '', 'Pricing Date': '', 'Settlement Date': '',
  'Maturity Date': '', Denomination: '', 'Governing Law': '',
  Listing: '', 'Day Count': '', 'Interest Type': '',
};

// Per-user in-memory rate limit (10s between calls). Resets when the
// function cold-starts, which is acceptable for prototype scope.
const lastCallByUser = new Map<string, number>();
const RATE_LIMIT_MS = 10_000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims || claimsData.claims.role !== 'authenticated') {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Admin-only (mirror DB policy that restricts deal writes to admins)
    const { data: roles, error: rolesErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (rolesErr) {
      console.error('roles lookup failed:', rolesErr.message);
      return jsonResponse({ error: 'forbidden' }, 403);
    }
    const isAdmin = (roles ?? []).some(r => r.role === 'master_admin' || r.role === 'syndicate_admin');
    if (!isAdmin) return jsonResponse({ error: 'forbidden' }, 403);

    // ── Rate limit ───────────────────────────────────────────────────────
    const now = Date.now();
    const last = lastCallByUser.get(userId) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
      return jsonResponse({
        error: 'rate_limit_local',
        message: `Please wait ${waitSec}s before extracting again.`,
      }, 429);
    }
    lastCallByUser.set(userId, now);

    // ── Validate input ───────────────────────────────────────────────────
    let payload: any;
    try { payload = await req.json(); }
    catch { return jsonResponse({ error: 'invalid_json' }, 400); }

    const text: unknown = payload?.text;
    const conversationLabel: string = typeof payload?.conversationLabel === 'string' ? payload.conversationLabel : '';
    const existingDeals: Array<any> = Array.isArray(payload?.existingDeals) ? payload.existingDeals : [];

    if (typeof text !== 'string' || text.trim().length < 20) {
      return jsonResponse({ error: 'text_too_short', message: 'Need at least 20 chars of chat text.' }, 400);
    }
    const HARD_MAX = 200_000;
    if (text.length > HARD_MAX) {
      return jsonResponse({ error: 'text_too_long', message: `Max ${HARD_MAX} chars.` }, 413);
    }
    // Cost cap
    const MAX_CHARS = 60_000;
    const transcript = text.length > MAX_CHARS ? text.slice(-MAX_CHARS) : text; // keep newest

    const dealsForPrompt = existingDeals.slice(0, 100).map(d => ({
      id: String(d.id ?? ''),
      issuerName: String(d.issuerName ?? ''),
      currency: String(d.currency ?? ''),
      size: String(d.size ?? ''),
      tenor: String(d.tenor ?? ''),
      stage: String(d.stage ?? ''),
      isin: String(d.isin ?? ''),
    })).filter(d => d.id);

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured');

    const userMsg = [
      conversationLabel ? `Conversation label: ${conversationLabel}` : '',
      `Existing deals (JSON list — match against these before deciding "new_deal"):`,
      JSON.stringify(dealsForPrompt),
      ``,
      `Chat transcript (oldest → newest):`,
      transcript,
    ].filter(Boolean).join('\n');

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
      }),
    });

    if (res.status === 429) return jsonResponse({ error: 'rate_limit', message: 'AI rate limit reached. Try again in a moment.' }, 429);
    if (res.status === 402) return jsonResponse({ error: 'credits_exhausted', message: 'AI credits exhausted. Add credits in workspace settings.' }, 402);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? '';
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let obj: any;
    try { obj = JSON.parse(raw); }
    catch {
      console.error('Failed to parse AI JSON:', raw.slice(0, 400));
      return jsonResponse({ error: 'ai_parse_failed', message: 'AI returned invalid JSON.' }, 502);
    }

    // ── Normalize / validate output ──────────────────────────────────────
    const mode = obj.mode === 'update_existing' ? 'update_existing' : 'new_deal';
    const matchedDealId = typeof obj.matchedDealId === 'string' ? obj.matchedDealId.trim() : '';
    const validatedMatchId = mode === 'update_existing' && dealsForPrompt.some(d => d.id === matchedDealId)
      ? matchedDealId : '';
    const effectiveMode = mode === 'update_existing' && !validatedMatchId ? 'new_deal' : mode;

    const keyTerms: Record<string,string> = { ...EMPTY_KEY_TERMS };
    if (obj.keyTerms && typeof obj.keyTerms === 'object') {
      for (const k of Object.keys(EMPTY_KEY_TERMS)) {
        const v = (obj.keyTerms as any)[k];
        keyTerms[k] = typeof v === 'string' ? v.trim() : '';
      }
    }

    const bookrunners = Array.isArray(obj.bookrunners) ? obj.bookrunners
      .filter((b: any) => b && typeof b.name === 'string' && b.name.trim())
      .map((b: any) => ({
        name: String(b.name).trim(),
        role: b.role === 'passive' ? 'passive' : 'active',
        isGlobalCoordinator: Boolean(b.isGlobalCoordinator),
      })) : [];

    const suggestedStage = typeof obj.suggestedStage === 'string' && (STAGES as readonly string[]).includes(obj.suggestedStage)
      ? obj.suggestedStage : '';

    const alerts = Array.isArray(obj.alerts)
      ? obj.alerts.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 12).map((s: string) => s.trim())
      : [];

    const confidence = typeof obj.confidence === 'number' && isFinite(obj.confidence)
      ? Math.min(1, Math.max(0, obj.confidence)) : 0.5;

    return jsonResponse({
      mode: effectiveMode,
      matchedDealId: validatedMatchId,
      matchReason: typeof obj.matchReason === 'string' ? obj.matchReason.trim() : '',
      confidence,
      keyTerms,
      bookrunners,
      suggestedStage,
      alerts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('extract-deal-from-chat error:', message);
    return jsonResponse({ error: 'extraction_failed', message }, 500);
  }
});