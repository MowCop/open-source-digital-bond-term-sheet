## Goal
Surface per-user login metrics (last login, account created, email confirmed) in the Address Book & User Admin section, visible to Master Admins.

## What already exists
- DB function `public.get_user_login_stats()` — returns `email`, `last_sign_in_at`, `confirmed_at`, `user_created_at`. Admin-gated via `is_admin(auth.uid())`.
- `UserManagementPage.tsx` / `AdminPage.tsx` already list bank + vendor users.

## What to build

1. **Fetch login stats** on the User Admin page via `supabase.rpc('get_user_login_stats')` and key results by lowercase email.

2. **Extend user tables** in User Management / Address Book with new columns:
   - **Last login** — relative time ("2h ago") with full timestamp on hover; "Never" if null.
   - **Account created** — date.
   - **Email confirmed** — ✓ date, or "Pending" badge if null.

3. **Top-of-page summary tiles** (Master Admin only):
   - Active in last 24h / 7d / 30d
   - Never logged in
   - Pending email confirmation

4. **Sortable** by Last login (desc default) so dormant accounts surface quickly.

## Metrics available now vs. later
Available immediately from `auth.users`: last sign-in, account created, email confirmed.

Not tracked yet (would need new audit instrumentation if you want them later): login count, session duration, pages visited, last action timestamp, failed login attempts. The existing `audit_log` table could be extended to capture some of these, but that's a separate piece of work — flag if you want it in scope.

## Questions before I build
- Add to **UserManagementPage** (Address Book) only, or also the simpler `AdminPage`?
- Want the summary tiles, or just the per-user columns?
- Should non-master Syndicate Admins see this too, or Master Admin only?
