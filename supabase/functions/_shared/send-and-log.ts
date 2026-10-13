import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail, type SendTemplateEmailOptions } from './transactional-email-templates/send-email.ts'

/** Sends a registered template and records the outcome in email_send_log (sent / suppressed / failed). */
export async function sendAndLog(templateName: string, to: string, options: SendTemplateEmailOptions = {}) {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const log = async (status: 'sent' | 'suppressed' | 'failed', error_message?: string) => {
    const { error } = await db.from('email_send_log').insert({
      message_id: null, template_name: templateName, recipient_email: to, status, error_message: error_message ?? null,
    })
    if (error) console.error('email_send_log write failed', { code: error.code, message: error.message })
  }
  try {
    const r = await sendTemplateEmail(templateName, to, options)
    await log(r.sent ? 'sent' : 'suppressed')
    return r
  } catch (e) {
    await log('failed', e instanceof Error ? e.message : String(e))
    throw e
  }
}
