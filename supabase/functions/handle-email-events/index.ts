import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.3.1'
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Mirrors the previous suppression records: notification-only, never gates sends.
async function record(
  eventId: string,
  recipient: string,
  reason: 'bounce' | 'complaint' | 'unsubscribe',
  status: 'bounced' | 'complained' | 'suppressed',
  message: string,
  messageId?: string | null,
) {
  const email = recipient.toLowerCase()
  const sb = db()
  const { error: sErr } = await sb.from('suppressed_emails').upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (sErr) {
    console.error('suppressed_emails write failed', { code: sErr.code, message: sErr.message, event_id: eventId })
    throw new Error('suppressed_emails write failed')
  }
  const { error: lErr } = await sb.from('email_send_log').insert({
    message_id: messageId ?? null, template_name: 'system', recipient_email: email,
    status, error_message: message, metadata: null,
  })
  if (lErr) {
    console.error('email_send_log write failed', { code: lErr.code, message: lErr.message, event_id: eventId })
    throw new Error('email_send_log write failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record(event.event_id, event.data.recipient, 'bounce', 'bounced',
        'Permanent bounce — email address is invalid or rejected', event.data.message_id)
    },
    'email.complaint': async (event) => {
      await record(event.event_id, event.data.recipient, 'complaint', 'complained',
        'Spam complaint — recipient marked email as spam', event.data.message_id)
    },
    'email.unsubscribed': async (event) => {
      await record(event.event_id, event.data.recipient, 'unsubscribe', 'suppressed',
        'Recipient unsubscribed', event.data.message_id)
    },
  },
})

Deno.serve((req) => handler(req))
