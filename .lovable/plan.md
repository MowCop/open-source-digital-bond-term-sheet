## Goal
Once a registrant is approved, they disappear from **Pending Approvals** and appear in a new **Users** list — both in the Address Book and on the Administration page. Rejected, disabled, and still-pending users stay in Pending Approvals.

## Changes

### 1. `PendingApprovalsTab.tsx`
- Filter out rows where `status === 'approved'` so only `pending | rejected | disabled` remain.
- Remove the now-unused "Revoke access" / role editor for approved rows (they'll live in the Users tab).
- Rename the section header to "Pending Approvals" for clarity; keep re-approve action on rejected/disabled.

### 2. New `ApprovedUsersTab.tsx` (Address Book)
- Loads `profiles` where `status = 'approved'`, joined with `user_roles` and login stats.
- Columns: Email, Name, Organization, Role (inline `Select` to change), Last Login, Actions.
- Actions:
  - **Change role** — same `persistRole` logic as today (writes `user_roles`, audit entry, toast).
  - **Revoke access** — sets `profiles.status = 'rejected'`, deletes `user_roles` row, audit entry. Row then reappears in Pending Approvals.
- Master Admin can assign `master_admin`; Syndicate Admin cannot (mirrors current `ALL_ROLES` gating).

### 3. Address Book page (wherever `PendingApprovalsTab` is mounted)
- Add a sibling tab: **Users** (approved) alongside **Pending Approvals**. Users tab is the default landing tab.

### 4. `AdminPage.tsx`
- Replace the current mock `users` (from `useApp()`) with a live load from `profiles` + `user_roles` filtered to `status = 'approved'`.
- Keep the existing "Bank Users" / "Vendor Users" split by deriving `organizationType` from `organization` (or drop the split into a single "Approved Users" table if no reliable org-type field exists — will confirm from data during build).
- Keep the inline role editor.

### 5. No schema changes
All data already lives in `profiles` + `user_roles`. No migration required.

## Out of scope
- No changes to signup flow, email notifications, or delete behaviour.
- No new "moved to Users" badge on the Pending tab (per your choice to hide entirely).
