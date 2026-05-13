# Contact Support on /auth

Add a "Contact support" button + dialog form on the Auth page. Submissions email `karl.mallalieu@gmail.com` via the existing Lovable Email pipeline. The recipient address is hard-coded server-side and never exposed to the browser.

## What gets built

1. **New email template** — `supabase/functions/_shared/transactional-email-templates/support-request.tsx`
   - React Email component, BondVDR brand styling (matches existing templates)
   - Renders: submitter name, submitter email, subject, message, timestamp
   - `to: 'karl.mallalieu@gmail.com'` baked into the template (not exposed to client)
   - Subject: `[BondVDR Support] {subject}`
   - `displayName: 'Support request'`

2. **Registry update** — `supabase/functions/_shared/transactional-email-templates/registry.ts`
   - Add `'support-request': supportRequest` to the `TEMPLATES` map

3. **Reply-To support** — `supabase/functions/send-transactional-email/index.ts`
   - Accept optional `replyTo` in request body, validate as email
   - Forward as `reply_to` in the enqueued payload so karl can reply directly to the submitter
   - Deploy after edits

4. **Frontend** — `src/pages/AuthPage.tsx`
   - "Contact support" link/button below the auth card (visible on all 3 tabs)
   - Opens a Dialog containing a form: Name, Email, Subject (≤150), Message (≤2000)
   - Validated with `react-hook-form` + `zod` (trim, length limits, valid email)
   - Submit calls `supabase.functions.invoke('send-transactional-email', { body: { templateName: 'support-request', idempotencyKey: 'support-<uuid>', replyTo: values.email, templateData: { name, email, subject, message, submittedAt } } })`
   - Toast on success/failure; reset + close dialog on success
   - Submit button disabled while in flight
   - Recipient address `karl.mallalieu@gmail.com` is **never** referenced in frontend code

## Verification

- Submit a test message from /auth in preview
- Confirm `email_send_log` shows `pending` → `sent` for `support-request`
- Confirm arrival at karl.mallalieu@gmail.com with working Reply-To

## Out of scope

- Server-side rate limiting / captcha (can add later if abuse appears)
- Storing submissions in a DB table (email-only flow as requested)
