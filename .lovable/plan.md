# Why no emails are reaching new sign-ups

I traced Etienne's signup end-to-end. Two distinct emails are *missing*, and they're missing for two different reasons.

## Root causes

### 1. No email-confirmation step on signup
Supabase auth logs show the signup completed with `immediate_login_after_signup: true`. That means email confirmation is **disabled** for this project, so Supabase never asks the auth-email-hook to send a "Confirm your email" message. The hook (and its branded template) are wired up correctly — they're simply never invoked because auth isn't asking for a confirmation.

This is why nothing appears in `email_send_log` for the signup. The only recent rows there are the two support-request emails from earlier today.

### 2. Approval doesn't trigger any email
`PendingApprovalsTab.approve()` only does:
- `UPDATE profiles SET status='approved'`
- `UPSERT user_roles`

There is no call to `send-transactional-email`, no template for "your account was approved", and nothing on the backend that reacts to the status change. So even after the admin clicks Approve, the new user is never told.

A separate gap: there is no "thanks for signing up — pending review" acknowledgement email to the new user either. `notify-author-on-signup` only emails the project author (karl@), not the signer-up.

## What I propose to fix

Three small, additive pieces. None of them touch the support-request flow that we just stabilised.

### A. Send a "signup received — pending approval" email to the new user
- New transactional template `signup-acknowledgement` (React Email, branded, white body) — short message: thanks, your access is pending admin review, you'll be notified.
- Trigger: extend `notify-author-on-signup` (already invoked from `AuthContext.signUp`) to **also** invoke `send-transactional-email` for the signer-up, in addition to the existing author notification. Idempotency key: `signup-ack-${userId}`.
- No client changes needed beyond what already happens.

### B. Send an "account approved" email when an admin approves
- New transactional template `account-approved` — short message: your access is live, click to sign in (link to `/auth`). Optionally mention assigned role.
- New edge function `notify-user-on-approval` (`verify_jwt = true`, admin-only check via `has_role`) that:
  - Validates caller is `master_admin` or `syndicate_admin`
  - Loads the target profile (email, name)
  - Invokes `send-transactional-email` with template `account-approved`, idempotency `approval-${userId}-${approvedAtMs}`
  - Writes an `audit_log` entry
- `PendingApprovalsTab.approve()` calls this function after the DB update succeeds. Failure to email is non-blocking (toast warning, approval still stands).

### C. Decide on auth email confirmation (recommended: leave OFF)
Because this app gates access behind manual admin approval anyway, double-confirming the email address adds friction without security benefit (an unverified email simply can't be approved meaningfully — the admin reviews it). I recommend **keeping confirmation disabled** and relying on (A)+(B) above. If you'd rather require email verification too, say the word and I'll enable it via auth config — the existing `auth-email-hook` + signup template will then start sending automatically.

## Verification steps after implementing
1. Sign up a fresh test address → confirm row in `email_send_log` for `signup-acknowledgement` transitions `pending → sent`, and inbox receives it.
2. As master admin, approve the pending user → confirm `account-approved` row in `email_send_log` and inbox receipt.
3. Confirm `karl@eurobondmarkets.com` still gets the existing `signup-notification` (unchanged).
4. Re-approve same user (idempotency) → no duplicate email.

## Technical notes
- All sends go through the existing `send-transactional-email` queue/retry pipeline — no new infra.
- Templates registered in `_shared/transactional-email-templates/registry.ts`.
- Both new templates use the same brand styling as `support-request.tsx`.
- `notify-user-on-approval` deployed via `deploy_edge_functions` after creation; `notify-author-on-signup` redeployed after edit.

Confirm and I'll implement A + B (and skip C unless you want it).
