## Why notifications stopped

A send to `karl@eurobondmarkets.com` hard-bounced on 13 May 2026. The email infrastructure automatically added the address to `suppressed_emails`, and every signup-notification since then has been logged as `status: suppressed` and never delivered (Adrian 14 May, Fiona 25 May, Simonas + Fiona 26 May). The signup flow itself is healthy — audit log rows are created, and signup-acknowledgement emails to the new users still send fine.

## Fix

1. **Unsuppress the author address.** Delete the row for `karl@eurobondmarkets.com` from `suppressed_emails` via migration so future notifications can be delivered again.

2. **Send a test notification** by triggering the `send-transactional-email` function with the `signup-notification` template to confirm delivery resumes (check `email_send_log` for a `sent` row).

3. **Investigate why it bounced.** The bounce was reported by the email provider as "address is invalid or rejected". Likely causes: DNS/SPF/DKIM hiccup at the time, or the recipient mailbox temporarily rejected. Confirm the address is correct (it matches the `AUTHOR_EMAIL` constant in `notify-author-on-signup` and the `to:` in the `signup-notification` template).

4. **Optional hardening (recommend, ask before doing):** Add a second fallback recipient (e.g. `karl.mallalieu@gmail.com`) inside `notify-author-on-signup` so a single bounced address can't silently block all future notifications. Implemented as an additional `send-transactional-email` invoke with its own idempotency key.

## Files / objects touched

- New migration: `DELETE FROM public.suppressed_emails WHERE email = 'karl@eurobondmarkets.com';`
- (Optional, step 4) `supabase/functions/notify-author-on-signup/index.ts` — add fallback recipient + deploy.

No schema, no UI, no auth changes.
