import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const first = xff.split(',')[0]?.trim()
  if (first) return first
  return req.headers.get('cf-connecting-ip') ?? 'unknown'
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  // Honeypot — silently succeed if filled.
  if (typeof body?.website === 'string' && body.website.trim().length > 0) {
    return jsonResponse({ success: true }, 200)
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!name || name.length > 100) {
    return jsonResponse({ error: 'Invalid name' }, 400)
  }
  if (
    !email ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonResponse({ error: 'Invalid email' }, 400)
  }
  if (!subject || subject.length > 150) {
    return jsonResponse({ error: 'Invalid subject' }, 400)
  }
  if (!message || message.length > 2000) {
    return jsonResponse({ error: 'Invalid message' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Rate limit per IP — 3 requests per 10 minutes.
  const ip = clientIp(req)
  const now = new Date()
  const windowFloor = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS)

  const { data: existing, error: rlReadError } = await supabase
    .from('support_request_rate_limit')
    .select('window_start, count')
    .eq('ip', ip)
    .maybeSingle()

  if (rlReadError) {
    console.error('Rate-limit read failed', rlReadError)
    return jsonResponse({ error: 'Server error' }, 500)
  }

  let nextCount = 1
  let nextWindowStart = now.toISOString()
  if (existing && new Date(existing.window_start) > windowFloor) {
    if (existing.count >= RATE_LIMIT_MAX) {
      return jsonResponse(
        { error: 'Too many requests. Please try again later.' },
        429,
      )
    }
    nextCount = existing.count + 1
    nextWindowStart = existing.window_start
  }

  const { error: rlWriteError } = await supabase
    .from('support_request_rate_limit')
    .upsert(
      { ip, window_start: nextWindowStart, count: nextCount },
      { onConflict: 'ip' },
    )
  if (rlWriteError) {
    console.error('Rate-limit write failed', rlWriteError)
    return jsonResponse({ error: 'Server error' }, 500)
  }

  const idempotencyKey = `support-${crypto.randomUUID()}`

  const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
    'send-transactional-email',
    {
      body: {
        templateName: 'support-request',
        idempotencyKey,
        replyTo: email,
        templateData: {
          name,
          email,
          subject,
          message,
          submittedAt: now.toISOString(),
        },
      },
    },
  )

  if (invokeError) {
    console.error('send-transactional-email invocation failed', invokeError)
    return jsonResponse({ error: 'Failed to send support request' }, 502)
  }

  console.log('Support request enqueued', { idempotencyKey, invokeData })
  return jsonResponse({ success: true }, 200)
})
