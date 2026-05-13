# Fix: Contact Support "Edge Function returned a non-2xx status code"

## Root cause

The Contact Support form on `/auth` calls `send-transactional-email` directly from the browser:

```ts
await supabase.functions.invoke('send-transactional-email', { body: {...} })
```

That function is **service-to-service only**. Two layers reject the call:

1. The Supabase gateway runs with `verify_jwt = true` (default). On `/auth` the visitor is **not signed in**, so the request carries only the anon key and is rejected with 401 before the function even boots — which matches the empty edge logs (only "booted" entries, no invocations).
2. Even with a valid user JWT, the function's own auth check requires the **service-role** key/JWT and otherwise returns 403.

That's why the toast shows "Edge Function returned a non-2xx status code" and nothing appears in `email_send_log`.

We must NOT expose the service role key to the browser, and we must NOT remove the service-role check on `send-transactional-email` (it would let anyone relay arbitrary emails through any registered template).

## Fix

Introduce a small **public** edge function dedicated to the support form, and have the frontend call that instead. The public function validates input, applies basic abuse protection, then invokes `send-transactional-email` server-side using the service role key.

### 1. New edge function `submit-support-request`

Path: `supabase/functions/submit-support-request/index.ts`
Config: add a block in `supabase/config.toml`:
```toml
[functions.submit-support-request]
verify_jwt = false
```
(unauthenticated callers must be allowed — visitors on /auth aren't logged in).

Behaviour:
- CORS preflight handled.
- Accept POST JSON: `{ name, email, subject, message }`.
- Server-side validate:
  - all fields present, trimmed, non-empty
  - `name` ≤ 100, `subject` ≤ 150, `message` ≤ 2000
  - `email` matches a basic email regex, ≤ 320 chars
  - reject otherwise with 400.
- Lightweight abuse protection (no captcha yet, keep scope tight):
  - Honeypot field `website` — if present and non-empty, return 200 silently.
  - Per-IP rate limit using a new table `support_request_rate_limit (ip text primary key, window_start timestamptz, count int)` — max 3 requests / 10 min / IP. Use `x-forwarded-for` first hop. On limit breach return 429.
- Build a deterministic `idempotencyKey` = `support-${crypto.randomUUID()}`.
- Use the service-role Supabase client to invoke `send-transactional-email`:
  ```ts
  await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'support-request',
      idempotencyKey,
      replyTo: email,
      templateData: { name, email, subject, message, submittedAt: new Date().toISOString() },
    },
  })
  ```
  The recipient stays baked into the `support-request` template (`karl.mallalieu@gmail.com`) — never referenced in the public function or the frontend.
- Return `{ success: true }` on enqueue success, `{ error }` with 5xx on failure.

### 2. Frontend change in `src/pages/AuthPage.tsx`

In `submitSupport`, replace the `send-transactional-email` invoke with:
```ts
await supabase.functions.invoke('submit-support-request', {
  body: { name, email, subject, message },
})
```
Drop `templateName`, `idempotencyKey`, `replyTo`, `templateData` from the client payload — those are now server-owned. Keep the existing zod validation, toast, reset-on-success, and disabled-while-submitting behaviour. No UI changes.

### 3. Deploy & verify

1. `supabase--migration` to create `support_request_rate_limit` (RLS enabled, no policies — only service role writes).
2. `supabase--deploy_edge_functions` for `submit-support-request` (and re-deploy `send-transactional-email` is **not** needed — unchanged).
3. Manually submit the form from `/auth` while signed out.
4. Check:
   - `submit-support-request` logs show 200.
   - `send-transactional-email` logs show enqueue success.
   - `email_send_log` row transitions `pending` → `sent` for `template_name = 'support-request'`.
   - Email arrives at `karl.mallalieu@gmail.com` with working Reply-To.
5. Re-submit 4× quickly to confirm 429 on the 4th.

## Debugging guidance if it still fails

In order:

1. **Browser network tab** — look at the failed request to `/functions/v1/submit-support-request`. The status code tells you which side failed (4xx = our validation/rate-limit/auth, 5xx = function or downstream).
2. **`submit-support-request` edge logs** — confirm the function was actually invoked and inspect any console.error.
3. **`send-transactional-email` edge logs** — should now show invocations originating from the support function. A 403 here means the service-role key isn't being read inside the public function (env var missing).
4. **`email_send_log` table** — filter `template_name = 'support-request'`. `pending` with no follow-up = dispatcher not running; `failed` / `dlq` = check `error_message`.
5. **`cron.job`** — verify `process-email-queue` is scheduled. If missing, the queue won't drain.
6. **Suppression** — confirm `karl.mallalieu@gmail.com` is NOT in `suppressed_emails`.

## Out of scope

- hCaptcha / Turnstile (can be added later if abuse becomes an issue).
- Persisting submissions to a dedicated `support_requests` table (the email + log already give an audit trail).
- Any UI styling changes to the form.
