## Goal

In **User Management → Guests** (Syndicate Admin view), Sarah sees only the read-only guests she personally invited. Clicking a guest opens a right-hand drawer showing exactly which of her deals that guest can access, with inline edit/revoke controls.

## Part 1 — Scope the Guests list per Syndicate Admin

Today `GuestsTab` runs `select * from guest_passcodes` with no filter, so any admin sees every invite. Tighten this so:

- **Master Admin**: sees all rows.
- **Syndicate Admin**: sees only rows where `created_by = auth.uid()` (guests they personally invited). Same restriction for UPDATE/DELETE so Sarah cannot revoke Anna's invites.
- **Guests**: never reach this page (already blocked).

### Database changes
- Drop the existing `admins manage guest passcodes` ALL policy on `guest_passcodes`.
- Add four role-aware policies on `guest_passcodes`:
  - `master_admin` → full ALL.
  - `syndicate_admin` → SELECT/INSERT/UPDATE/DELETE limited to `created_by = auth.uid()`.
- `invite-guest` edge function already sets `created_by = user.id`, so no function change is needed.

## Part 2 — Drill-down side drawer (Option B)

Clicking a row in the Guests table opens a right-hand `Sheet` drawer. Existing row actions (regenerate, revoke) stay on the row for quick use; the drawer is for review and editing deal access.

### Drawer contents
- **Header**: guest name (or email), email, status badge (active / expired / revoked).
- **Identity block**: invited on, invited by (current admin), expires on, last used.
- **Authorised deals** section: list of deals the guest can access, each row shows `Issuer · Currency Size · Tenor · Stage` plus a small "Open deal" link. An `X` on each deal removes that deal from `deal_ids`. An "Add deal" combobox lets Sarah grant access to another of her deals (scoped via `useScopedApp().deals`, so she can only grant deals she owns).
- **Passcode block**: masked passcode with copy, plus "Regenerate" button.
- **Footer actions**: "Revoke access" (sets `revoked_at`), "Close".

### Behaviour
- All edits persist to `guest_passcodes` immediately and refresh the row.
- Add/remove deal writes to `deal_ids` via update; an audit_log entry is written (`guest_deal_access_changed`) with the diff.
- The drawer is read-only (no edit controls) when the passcode is revoked or expired.

## Out of scope
- No new dedicated route; drawer only.
- No login/passcode-flow changes.
- No new activity timeline yet (room left in drawer to add later).
- No changes to deal/message scoping logic — already handled by `scopeDeals` / `scopeMessages`.

## Files touched
- `supabase/migrations/<new>.sql` — replace `guest_passcodes` RLS policies.
- `src/components/GuestsTab.tsx` — add row click handler, render `<GuestDetailDrawer />`, remove any client filtering that becomes redundant.
- `src/components/GuestDetailDrawer.tsx` (new) — drawer UI + add/remove deal + revoke + regenerate.
