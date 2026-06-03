## What I found

The signup pipeline is wired correctly:

```
AuthPage (signup tab)
  → AuthContext.signUp()
      → supabase.auth.signUp()
      → invoke notify-author-on-signup
          → send-transactional-email × 3:
              1. signup-notification → karl@eurobondmarkets.com  (primary)
              2. signup-notification → karl.mallalieu@gmail.com  (fallback)
              3. signup-acknowledgement → new user
```

Email infra is healthy:
- Sender domain `notify.eurobondmarkets.com` is **verified**.
- Queue, RPCs, and send-transactional-email function are deployed.
- `suppressed_emails` table is currently empty.

But two real problems show up in `email_send_log`:

1. **Primary author address has a deliverability problem.** On 2026-05-13 a system email to `karl@eurobondmarkets.com` was logged with `status = bounced`, error "Permanent bounce — email address is invalid or rejected". Every `signup-notification` to that address after that (5 attempts on 5/14, 5/25, 5/26) was logged as `suppressed`. The suppression list is empty now, so the next attempt would try again — and likely bounce again, re-suppressing the address. **Net effect today: the author probably is not receiving signup notifications.**

2. **The fallback to `karl.mallalieu@gmail.com` has never fired.** The source code in `notify-author-on-signup/index.ts` (lines 78–94) sends the fallback, but `email_send_log` shows zero rows for that recipient/template combo across every signup since this code was written. This strongly suggests the deployed Edge Function predates the fallback code and was never redeployed. The signup-acknowledgement to the new user does send correctly.

## Plan

1. **Redeploy `notify-author-on-signup`** so the fallback path actually runs in production.

2. **Make the author notification deliverable.** Two options to discuss:
   - (a) Keep `karl@eurobondmarkets.com` as primary and fix the mailbox at the mail provider so it stops bouncing.
   - (b) Swap primary and fallback so `karl.mallalieu@gmail.com` becomes the primary recipient and `karl@eurobondmarkets.com` becomes the secondary. (Lowest-risk change — no DNS / mail-server work.)

3. **Verify end-to-end on production.** After step 1 (and optionally step 2), perform one real signup at https://eurobondmarkets.com/auth with a throwaway address, then re-check `email_send_log`:
   - `signup-notification` → primary author: expect `sent`.
   - `signup-notification` → fallback author: expect `sent`.
   - `signup-acknowledgement` → new user: expect `sent`.
   - Confirm both inboxes physically received the message (not just `sent` in the log).

4. **If the primary still bounces**, switch to option 2(b) and re-test.

No other code changes needed; the rest of the pipeline (template rendering, queue dispatch, cron, signup-acknowledgement) is working as evidenced by every recent `sent` row for new-user acknowledgements and approval emails.

## One question for you

Before I redeploy, do you want me to also swap the primary/fallback so notifications go to **karl.mallalieu@gmail.com first** (and `karl@eurobondmarkets.com` second)? That's the safest fix given the historical bounce on the eurobondmarkets address. If you'd rather keep the current order, I'll just redeploy and we'll see whether the address still bounces.