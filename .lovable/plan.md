# Authentication & Onboarding Plan

Two distinct entry paths on a single login page:
1. **Syndicate users** — email + password, full registration
2. **Guests** — email + passcode, deal-scoped read-only, no registration

Plus: invite-on-register notification to the project author, and an admin-driven guest onboarding flow inside User Management.

---

## 1. Login / Signup Page (`/auth`)

A single public page with two tabs (or two stacked sections):

```
┌─────────────────────────────────┐
│  BondVDR                        │
│  ─────────────────────────────  │
│  Email           [_________]    │
│  Password        [_________]    │
│           [ Log in ]            │
│           [ Sign up ]           │
│  ─────────────────────────────  │
│  Guest access                   │
│  Email           [_________]    │
│  Passcode        [_________]    │
│           [ Enter as guest ]    │
└─────────────────────────────────┘
```

- **Email + Password** → standard Lovable Cloud auth (`signUp` / `signInWithPassword`). Email confirmation disabled for prototype speed (configurable).
- **Email + Passcode** → custom edge function `guest-login` that validates the passcode against `guest_passcodes`, then issues a short-lived session (stored in a signed JWT in localStorage, or a Supabase anonymous-style session limited by RLS using a custom claim). For this MVP-friendly approach, we mint a client-side guest session record and gate the app on it.
- All other routes are wrapped in a `RequireAuth` guard that redirects unauthenticated visitors to `/auth`.

## 2. Syndicate Signup → Author Notification

When a public visitor self-registers:
1. Account is created in `auth.users` and a row in a new `profiles` table (status `pending_review`, role defaulting to `syndicate_readonly`).
2. Edge function `notify-author-on-signup` sends an email to `karl.mallalieu@gmail.com` containing: name, email, organisation, signup time, and an "Approve / Reject" link that deep-links into User Management.
3. Until approved, the user lands on a "Pending approval" screen — they cannot see deals, chats, or alerts.

Author email uses Lovable's built-in transactional email (no third-party key needed). Domain prompt will appear on first send.

## 3. Guest Passcode Onboarding (Syndicate Admin flow)

In **User Management**, add a third tab **"Guests"**:
- Admin clicks **Invite Guest** → modal asks for email, name, and which deals the guest may view (multi-select).
- On save: a row is inserted in `guest_passcodes` with a generated 8-char alphanumeric passcode, the deal IDs, and an optional expiry.
- Guest receives an email (via transactional email) containing their passcode and the login URL.
- Admin can **revoke** or **regenerate** a passcode at any time. Revoking invalidates the row immediately.
- Guests who log in with passcode see ONLY the deals on that record, in read-only mode (no chat send, no alert create).

**Suggested enhancements** (called out for the user to choose from):
- One-click "Resend passcode email" button
- Bulk-invite by CSV upload
- Auto-expire passcodes after N days, configurable per invite
- Audit-log every guest login (already partially supported via `audit_log`)
- "Magic link" alternative — clickable URL that embeds the passcode for 1-click access

## 4. Privacy: Users BCC'd Everywhere

- All recipient lists (alerts, distribution lists, message recipients) are rendered as a count, not names, except inside chat rooms where participants are intentionally visible.
- A helper `redactRecipients(user, recipients)` returns `["You", "+ 12 others"]` for non-admins.
- User Management list is restricted to `master_admin` and `syndicate_admin` only. Other authenticated users cannot access `/admin` or query the users table beyond their own profile (enforced via RLS once roles are migrated to a `user_roles` table — see Technical section).

## 5. Suggested Further Enhancements

- **Email verification toggle** — currently auto-confirm for prototype; flip on for production
- **Google sign-in** for syndicate users (one click from the login page)
- **Approval queue dashboard** for the author with one-click approve/reject and role assignment
- **Self-service password reset** at `/reset-password`
- **Per-deal guest access expiry** displayed to the guest as a countdown
- **Rate-limit guest login attempts** in the edge function to prevent passcode brute force
- **Two-factor for syndicate admins** (optional)

---

## Technical section

**New tables (migration):**
- `profiles` (user_id PK → auth.users, name, organisation, status: 'pending'|'approved'|'rejected', created_at)
- `user_roles` (user_id, role enum: master_admin|syndicate_admin|syndicate_readonly|sales_readonly|vendor_user) — separate from profiles to prevent privilege escalation
- `guest_passcodes` (id, email, passcode_hash, deal_ids jsonb, created_by, expires_at, revoked_at, last_used_at)
- Security-definer fn `has_role(_user_id, _role)` for RLS

**RLS rewrite:** existing tables currently allow anonymous full access. Tighten to:
- authenticated users can read their own data
- admins (`has_role`) can read/write user/admin data
- guests can read only deals whose IDs are in their active passcode record (validated server-side via edge function returning a scoped data payload, since guests aren't real auth users)

**Edge functions:**
- `notify-author-on-signup` — triggered after profile insert
- `guest-login` — validates email + passcode, returns scoped deal/message/chat payload + a signed guest token
- `invite-guest` — admin-only, generates passcode + sends email

**Frontend:**
- `/auth` page with tabs
- `RequireAuth` wrapper in `App.tsx`
- New `AuthContext` layered above `AppContext` exposing `session`, `role`, `isGuest`, `guestDealIds`
- `AppContext` switches data source: real Supabase queries for authenticated users, `guest-login` payload for guests
- "Guests" tab in `UserManagementPage`
- "Pending approval" screen for unapproved syndicate users

**Email infra:** triggers Lovable email domain dialog on first send; templates scaffolded for: signup-pending-author, guest-passcode, guest-passcode-revoked.

**Note on existing data:** current tables use `text` user IDs and permissive RLS for the prototype demo. The migration will keep the prototype users working while layering real auth on top — `profiles.user_id` links the real auth user to the existing demo `users.id` so the AppContext continues to function.
