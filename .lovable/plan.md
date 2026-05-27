## Goal
Add a **Last Login** column to the Approvals tab (PendingApprovalsTab) showing when each approved user last signed in, with relative time and full timestamp on hover.

## Why this works
- The backend already exposes `get_user_login_stats()` RPC returning `last_sign_in_at` per email.
- The UserManagementPage already fetches and formats this data (relative time + hover tooltip).
- We reuse the same pattern in PendingApprovalsTab.

## What to change

### 1. PendingApprovalsTab.tsx — fetch login stats
- On mount, call `supabase.rpc('get_user_login_stats')`.
- Build a lookup map keyed by lowercase email → `{ lastSignInAt, confirmedAt }`.
- Store in local state (`loginStats`).

### 2. PendingApprovalsTab.tsx — add "Last Login" column
- Insert a new `<TableHead>Last Login</TableHead>` between **Role** and **Actions**.
- For each row, look up `loginStats[p.email.toLowerCase()]`.
- Display:
  - Relative time (e.g. "2h ago", "3d ago", "Never") using the same `formatRelative` logic.
  - Full timestamp on hover via `title` attribute (e.g. "May 27, 2026, 2:30 PM").
  - Color-coded text: green for <24h, amber for <7d, muted for older / never.
- Show "—" for non-approved statuses (pending/rejected/disabled), since they haven't had app access yet.

### 3. Reuse formatting (optional)
- Either inline the same `formatRelative` / `formatFullTimestamp` helpers, or extract them to a shared utility if desired. Given this is a one-off, inlining keeps the change contained.

## Out of scope
- No DB changes needed.
- No new RPCs or migrations needed.
- No changes to UserManagementPage or other pages.

## Result
Master admins viewing the Approvals tab will see at a glance which approved users are actively using the platform and which accounts have gone dormant.