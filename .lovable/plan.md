## Goal

Improve the Approval row in **Address Book → Approvals** so actions are status-aware, and Delete is clearly separated from Reject with a confirmation dialog. Deletes are **soft** (preserve audit trail).

## UX changes (PendingApprovalsTab)

Replace the current `[Approve] [X]` pair with **status-aware actions** plus a separate destructive action behind a kebab menu.

```text
Status      | Actions
------------|----------------------------------------------------
Pending     | [Approve]  [Reject]                       ⋯
Approved    | [Revoke access]                           ⋯
Rejected    | [Re-approve]                              ⋯
Disabled    | [Re-approve]                              ⋯
```

The `⋯` menu always contains a single red **"Delete user…"** item, which opens an `AlertDialog` ("Delete this user? This will disable their account and revoke access. Y/N").

### Action semantics

- **Approve** → set `profiles.status = 'approved'` and upsert role from the row's role selector.
- **Reject** → set `profiles.status = 'rejected'`. Role row is left untouched.
- **Revoke access** → set `profiles.status = 'rejected'` and delete the row from `user_roles`.
- **Re-approve** → set `profiles.status = 'approved'` and re-upsert the role from the selector.
- **Delete user (soft)** → set `profiles.status = 'disabled'` and delete the row from `user_roles`. The auth user and profile row are kept so audit log entries still resolve to a known user. A small "Disabled" badge replaces the role selector.

All actions write an entry to `audit_log` (action types: `USER_APPROVED`, `USER_REJECTED`, `USER_REVOKED`, `USER_DELETED`).

## Schema change

`profiles.status` is currently a `profile_status` enum with values `pending | approved | rejected`. Add a new value:

```sql
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'disabled';
```

No other schema changes. RLS already restricts approval/role management to admins via `is_admin()`.

## Access control

The Approvals tab and the User Admin section are already gated to Master Admin in `UserManagementPage.tsx` (from the previous task). No change to gating.

## Files affected

- `src/components/PendingApprovalsTab.tsx` — replace action cell with status-aware buttons + `DropdownMenu` (⋯) + `AlertDialog` for delete confirmation. Add handlers `approve`, `reject`, `revoke`, `reapprove`, `softDelete`. Render "Disabled" badge when status is `disabled`.
- `supabase/migrations/<timestamp>_profile_status_disabled.sql` — add the `disabled` enum value.

No changes to backend functions, auth, or other pages.

## Out of scope

- Hard-deleting the auth user (would need an admin edge function; rejected per "soft delete" choice).
- Bulk actions, search/filter on the approvals list, or pagination.
