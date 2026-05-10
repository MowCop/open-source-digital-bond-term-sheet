## Goal
Add a Master Admin–only section that lists all registered users (from the backend `profiles` table), shows each user's active/inactive status, and lets karl.mallalieu@gmail.com toggle them on/off.

## Access control
- Gate by email: only the logged-in user with `karl.mallalieu@gmail.com` can see and use this section.
- Hide the nav entry for everyone else; if anyone navigates directly to the route, show a "Restricted" message.
- Expose the user's email from `AuthContext` (already available via `authUser.email`).

## Where it lives
- New page: `src/pages/MasterAdminPage.tsx`
- New route: `/master-admin` registered in `src/App.tsx`
- New sidebar link "Master Admin" (shield icon) in `src/components/AppLayout.tsx`, visible only when `authUser?.email === 'karl.mallalieu@gmail.com'`

## Data model
The `profiles` table already has a `status` column (`pending` | `approved` | `rejected`). We'll reuse it as the active/inactive flag:
- **Active** = `approved`
- **Inactive** = `rejected` (or `pending` for never-activated)

This avoids a schema migration and keeps `RequireAuth`'s existing approval gate working — deactivating a user immediately blocks their access on next load.

## Page UI
A single table of all profiles with columns:

```text
Name | Email | Organization | Status | Action
```

- **Status** column: green "Active" badge if `status='approved'`, grey "Inactive" badge otherwise.
- **Action** column: a `Switch` (or Activate/Deactivate button) that flips the row's status between `approved` and `rejected`.
- Confirmation toast on success; error toast on failure.
- Optional search box at the top to filter by name/email.

## How updates work
- On toggle, call `supabase.from('profiles').update({ status: newStatus }).eq('user_id', row.user_id)`.
- Existing RLS policy `admins update profiles` requires `is_admin(auth.uid())`. Karl's account must have a row in `user_roles` with role `master_admin` for the update to succeed.
- After update, refetch the list (or optimistically update local state).

### Bootstrapping Karl's admin role
If Karl doesn't yet have a `master_admin` role row, the page will show a one-time banner "You need master_admin role to manage users" — we'll handle this by running an insert during the implementation step (via the data tool) so the very first load works:
- Find Karl's `user_id` from `profiles` where `email='karl.mallalieu@gmail.com'`
- Insert into `user_roles` with role `master_admin` if missing
- Also flip his profile `status` to `approved`

## Files to create / edit
- **Add** `src/pages/MasterAdminPage.tsx` — list + toggle UI
- **Edit** `src/App.tsx` — register `/master-admin` route
- **Edit** `src/components/AppLayout.tsx` — add sidebar item gated by Karl's email

## Out of scope
- No schema changes (reusing existing `status` field).
- No email notifications on activate/deactivate.
- No bulk actions (single-row toggle only).