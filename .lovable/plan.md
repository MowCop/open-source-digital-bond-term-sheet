## Goal
Lock down the Master Admin section so only `karl.mallalieu@gmail.com` can see it, prevent its data from leaking elsewhere, and ensure Master Admin–specific audit entries are visible only to him.

## Scope of changes

### 1. Master Admin access (already gated, hardening)
- Confirm in `src/components/AppLayout.tsx` and `src/pages/MasterAdminPage.tsx` that the nav link and page body are only rendered when `authUser?.email === 'karl.mallalieu@gmail.com'` (already implemented). Add the same guard inside `App.tsx` route element so direct navigation to `/master-admin` for any other user (including admins) renders the "Restricted" card.
- No other page imports `MasterAdminPage` data — confirmed. No copy/parse of its user list elsewhere.

### 2. Tag Master Admin audit entries
- In `MasterAdminPage.tsx`, when toggling user status, write a dedicated audit entry via `supabase.from('audit_log').insert(...)` with:
  - `action`: `MASTER_USER_ACTIVATED` / `MASTER_USER_DEACTIVATED`
  - `entity_type`: `master_admin`
  - `user_id`: Karl's auth id
  - `details`: `Activated/Deactivated <email>`
- Use a distinct `entity_type = 'master_admin'` so RLS and UI filters can isolate it.

### 3. Hide Master Admin audit rows from everyone except Karl
Two layers:

**a) Database (RLS) — replace the current "anon read audit" all-true policy with role-based rules:**
- `SELECT` for Master Admin (`has_role(auth.uid(), 'master_admin')` AND email matches): can read all rows.
- `SELECT` for everyone else (anon + authenticated): can read rows where `entity_type <> 'master_admin'`.
- Keep INSERT permissive (the app writes audit rows from many flows).
- DELETE/UPDATE: restrict to Master Admin only (no general need to mutate audit history).

**b) Frontend filter in `AuditLogPage.tsx`:** also filter out `entity_type === 'master_admin'` rows for non-master users, as defense-in-depth in case the cached `auditLog` in `AppContext` contains them.

### 4. Don't pollute the global app audit feed
- `AppContext.addAuditEntry` currently pushes to a shared `auditLog` state used by `AuditLogPage`. For Master Admin events, bypass `addAuditEntry` and write straight to `supabase` (so the row exists in DB only). The realtime subscription in `AppContext` will receive it for Karl but RLS will filter it out for everyone else.

## Files to edit
- `supabase/migrations/<new>.sql` — replace audit_log SELECT/UPDATE/DELETE policies, add master-admin scoped policies.
- `src/pages/MasterAdminPage.tsx` — write Master Admin audit rows directly to `audit_log` on activate/deactivate.
- `src/pages/AuditLogPage.tsx` — client-side filter to drop `master_admin` entity_type rows for non-master viewers.
- `src/App.tsx` — wrap `/master-admin` route to render Restricted card for non-master users (defense-in-depth alongside the page-level check).

## Out of scope
- No schema column changes; reusing existing `entity_type` field.
- No changes to existing non-audit RLS policies.
- No email notifications on activation events.
