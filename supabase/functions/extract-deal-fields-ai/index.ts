import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * extract-deal-fields-ai
 * ─────────────────────────────────────────────────────────────────────────────
 * Input  : { text: string }   — raw text extracted from a PDF/DOCX attachment
 * Output : { keyTerms: Record<string,string>, bookrunners: Bookrunner[] }
 *
 * Uses Lovable AI (Gemini) with JSON-mode to extract ICMA-style bond deal
 * terms from a document. The keyTerms keys match what AIDraftPage / DealChecker
 * consume today (see src/lib/alertParsing.ts -> simulateAIExtraction).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SYSTEM_PROMPT = `You are a fixed-income syndicate analyst extracting bond new-issue terms from term sheets, mandate announcements, and pricing press releases.

Return STRICT JSON matching this TypeScript type — no markdown, no commentary:

{
  "keyTerms": {
    "Issuer Name": string,         // legal borrower name only, never a bookrunner
    "Currency": string,            // ISO code: EUR, USD, GBP, CHF, JPY, ...
    "Size": string,                // e.g. "500m", "1bn"
    "Tenor": string,               // e.g. "5Y", "10Y", "Due 2030"
    "Reoffer Spread": string,      // e.g. "MS+85", "Swaps+120"
    "Issuer Rating": string,       // e.g. "A/A2" or "BBB+/Baa1/BBB+ Fitch"
    "ISIN": string,                // 12-char ISO 6166
    "LEI": string,                 // 20-char GLEIF code
    "Coupon": string,              // e.g. "3.25%" or "TBD"
    "Issue Price": string,         // e.g. "99.876"
    "Reoffer Price": string,
    "Reoffer Yield": string,       // e.g. "3.456%"
    "Mid-Swap Rate": string,
    "Pricing Date": string,        // keep document format
    "Settlement Date": string,
    "Maturity Date": string,
    "Denomination": string,        // e.g. "EUR 100,000 x 1,000"
    "Governing Law": string,       // "English Law" | "New York Law" | "German Law" | "French Law" | "Swiss Law"
    "Listing": string,             // venue name only
    "Day Count": string,           // "ACT/ACT" | "ACT/360" | "ACT/365" | "30/360" | "30E/360"
    "Interest Type": string        // "Fixed" | "Floating" | "Zero Coupon"
  },
  "bookrunners": [
    { "name": string, "role": "active" | "passive", "isGlobalCoordinator": boolean }
  ]
}

Rules:
- If a field is not present in the document, return an EMPTY STRING "" (never null, never a guess).
- Never put a bank name in "Issuer Name". The issuer is the borrower raising money.
- Bookrunners: include only banks acting in a syndicate role (Active/Passive Bookrunner, Joint Lead Manager, Global Coordinator). Mark Global Coordinators with isGlobalCoordinator=true. If the doc only says "Joint Bookrunner" without active/passive, default role to "active".
- Preserve the document's own date format — do not reformat dates.
- Do not invent ISINs, LEIs or ratings.`;

interface ExtractResult {
  keyTerms: Record<string, string>;
  bookrunners: Array<{ name: string; role: 'active' | 'passive'; isGlobalCoordinator: boolean }>;
}

const EMPTY: ExtractResult = {
  keyTerms: {
    'Issuer Name': '', Currency: '', Size: '', Tenor: '',
    'Reoffer Spread': '', 'Issuer Rating': '', ISIN: '', LEI: '',
    Coupon: '', 'Issue Price': '', 'Reoffer Price': '', 'Reoffer Yield': '',
    'Mid-Swap Rate': '', 'Pricing Date': '', 'Settlement Date': '',
    'Maturity Date': '', Denomination: '', 'Governing Law': '',
    Listing: '', 'Day Count': '', 'Interest Type': '',
  },
  bookrunners: [],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── Auth: require an authenticated (non-anon) caller ───────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims || claimsData.claims.role !== 'authenticated') {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured');

    // ── Server-side input validation ──────────────────────────────────────
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json', message: 'Body must be valid JSON.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const text = (payload as { text?: unknown })?.text;
    if (typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'invalid_input', message: '`text` must be a string.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const trimmed = text.trim();
    if (trimmed.length < 20) {
      return new Response(JSON.stringify({ error: 'text_too_short', message: '`text` must be at least 20 characters.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Hard cap on raw payload — protects gateway from runaway uploads.
    const HARD_MAX_CHARS = 200_000;
    if (text.length > HARD_MAX_CHARS) {
      return new Response(JSON.stringify({
        error: 'text_too_long',
        message: `\`text\` exceeds ${HARD_MAX_CHARS.toLocaleString()} characters (got ${text.length.toLocaleString()}).`,
      }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cap input to keep latency/cost reasonable. Term sheets are usually <30k chars.
    const MAX_CHARS = 60_000;
    const input = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

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
          { role: 'user', content: `Extract bond deal terms from this document:\n\n${input}` },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limit', message: 'AI rate limit reached. Try again in a moment.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: 'credits_exhausted', message: 'AI credits exhausted. Add credits in workspace settings.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? '';
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed: ExtractResult;
    try {
      const obj = JSON.parse(raw);
      parsed = {
        keyTerms: { ...EMPTY.keyTerms, ...(obj.keyTerms ?? {}) },
        bookrunners: Array.isArray(obj.bookrunners)
          ? obj.bookrunners
              .filter((b: any) => b && typeof b.name === 'string' && b.name.trim())
              .map((b: any) => ({
                name: String(b.name).trim(),
                role: b.role === 'passive' ? 'passive' : 'active',
                isGlobalCoordinator: Boolean(b.isGlobalCoordinator),
              }))
          : [],
      };
    } catch (_e) {
      console.error('Failed to parse AI JSON:', raw.slice(0, 400));
      parsed = EMPTY;
    }

    // Normalise all string values
    for (const k of Object.keys(parsed.keyTerms)) {
      const v = parsed.keyTerms[k];
      parsed.keyTerms[k] = typeof v === 'string' ? v.trim() : '';
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('extract-deal-fields-ai error:', message);
    return new Response(JSON.stringify({ error: 'extraction_failed', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});