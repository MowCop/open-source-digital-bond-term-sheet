/**
 * Shared model routing for the deal AI tools.
 * - No/unknown model  → existing Gemini chat-completions call (unchanged default).
 * - anthropic/* model → native /v1/messages, streamed and accumulated.
 */
export const CLAUDE_MODELS = [
  'anthropic/claude-haiku-4-5',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-opus-5',
  'anthropic/claude-opus-5-5',
  'anthropic/claude-fable-5-1',
] as const;

export const DEFAULT_MODEL = 'google/gemini-2.5-flash';

export function pickModel(input: unknown): string {
  return typeof input === 'string' && (CLAUDE_MODELS as readonly string[]).includes(input) ? input : DEFAULT_MODEL;
}

export type ModelResult =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string; message: string };

const GATEWAY = 'https://ai.gateway.lovable.dev/v1';

function failure(status: number, body: string): ModelResult {
  let message = '';
  try { const j = JSON.parse(body); message = j?.error?.message || j?.message || ''; } catch { /* ignore */ }
  if (status === 429) return { ok: false, status, error: 'rate_limit', message: message || 'AI rate limit reached. Try again in a moment.' };
  if (status === 402) return { ok: false, status, error: 'credits_exhausted', message: message || 'AI credits exhausted. Add credits in workspace settings.' };
  if (status === 403) return { ok: false, status, error: 'forbidden', message: message || 'This AI model is not available for the workspace.' };
  return { ok: false, status: status >= 500 ? 502 : status, error: 'ai_failed', message: message || `AI request failed (${status}).` };
}

export async function runModel(opts: {
  model: string; system: string; user: string; maxTokens?: number;
}): Promise<ModelResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured');

  if (!opts.model.startsWith('anthropic/')) {
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        response_format: { type: 'json_object' },
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
      }),
    });
    if (!res.ok) return failure(res.status, await res.text());
    const data = await res.json();
    return { ok: true, text: data?.choices?.[0]?.message?.content ?? '' };
  }

  const res = await fetch(`${GATEWAY}/messages`, {
    method: 'POST',
    headers: {
      'Lovable-API-Key': apiKey,
      Authorization: `Bearer ${apiKey}`,
      'X-Lovable-AIG-SDK': 'fetch',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 16000,
      stream: true,
      system: opts.system + '\n\nRespond with the JSON object only.',
      messages: [{ role: 'user', content: opts.user }],
    }),
  });
  if (!res.ok || !res.body) return failure(res.status, await res.text());

  // Accumulate streamed text deltas.
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '', refused = false, streamErr = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text;
        else if (ev.type === 'message_delta' && ev.delta?.stop_reason === 'refusal') refused = true;
        else if (ev.type === 'error') streamErr = ev.error?.message || 'stream error';
      } catch { /* ping or partial */ }
    }
  }
  if (streamErr) return { ok: false, status: 502, error: 'ai_failed', message: streamErr };
  if (refused) return { ok: false, status: 422, error: 'refused', message: 'The model declined this request.' };
  // Claude may wrap JSON in prose; keep the outermost object.
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  return { ok: true, text: s >= 0 && e > s ? text.slice(s, e + 1) : text };
}
