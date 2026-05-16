## Problem

In Address Book & User Admin → Approvals, the Role dropdown is backed only by local component state (`roleByUser`). Two bugs result:

1. For **approved** users, changing the Role dropdown does nothing — there is no save handler. Navigating away and back re-mounts the component, which re-loads profiles but never reads existing roles, so the dropdown falls back to the default `'syndicate_readonly'` regardless of what was previously chosen.
2. The dropdown is never seeded from the `user_roles` table, so it doesn't reflect the user's actual current role on load.

## Fix

In `src/components/PendingApprovalsTab.tsx`:

1. **Load existing roles** alongside profiles in `load()`:
   - Query `user_roles` for all `user_id`s in the result set.
   - Seed `roleByUser` with `{ [user_id]: role }` so the dropdown shows each user's current role on mount.

2. **Persist role changes immediately** for already-approved users:
   - Add `persistRole(userId, newRole)`: delete existing rows in `user_roles` for that `user_id`, then insert the new role (the table has a `unique (user_id, role)` constraint, so a plain upsert on `user_id` alone won't replace a different role — delete + insert is the simplest correct path).
   - In the Select's `onValueChange`, update local state as today; if the user's status is `approved`, also call `persistRole` and toast on success/failure, and write an `audit_log` entry (`USER_ROLE_CHANGED`).
   - For `pending` / `rejected` / `disabled` users, keep current behaviour — the role only gets written when Approve / Re-approve is clicked.

3. After mutations that change roles (approve, revoke, persistRole), `load()` already re-syncs everything from the DB, so the dropdown will always reflect the persisted truth on return to the page.

No schema or RLS changes needed — existing `admins manage roles` policy on `user_roles` covers admin upserts and deletes.

## Files touched

- `src/components/PendingApprovalsTab.tsx` — only file edited.
