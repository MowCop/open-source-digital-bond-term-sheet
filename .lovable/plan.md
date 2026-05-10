## Goal
Implement the simplified Syndicate Admin access model and surface it as a tooltip in the Master Admin page.

## Behavior changes

**Syndicate Admin (owner of own workspace)**
- Sees only deals where they are creator/bookrunner, plus users and distribution lists tied to those deals (already in place via `scoping.ts`).
- Can invite any user (including Syndicate Admins from other firms) as **read-only guests** on specific deals they own.

**Read-only guest invites (per deal)**
- Per-deal, not per-org. Doesn't change the invitee's Syndicate Admin status anywhere else.
- A user can simultaneously be Syndicate Admin on Deal A and read-only guest on Deal B.

## Implementation

### 1. Tooltip in Master Admin page
- Add an info icon next to the "Syndicate Admin" column header in `src/pages/MasterAdminPage.tsx`.
- On hover, show the simplified explanation:
  > Syndicate Admin = owner of their own deals/users/lists.
  > Inside User Management they can invite anyone (even Syndicate Admins from other firms) as read-only guests on specific deals they own.
  > Read-only invites are per-deal and don't change the invitee's Syndicate Admin status.
  > Example: Sarah (GlobalBank) invites Anna (EuroBank) as read-only on Deal A. Anna stays full Syndicate Admin on her own Deal B.
- Use existing shadcn `Tooltip` component.

### 2. Per-deal read-only guest invites in User Management
- In `src/pages/UserManagementPage.tsx`, add an "Invite read-only guest" action (visible to Syndicate Admins) that lets them:
  - Pick an existing user (any org) or enter email + name.
  - Pick one or more deals from the deals **they own**.
  - Submit → creates a `guest_passcodes` row scoped to those deal IDs (reuses existing guest mechanism + `invite-guest` edge function).
- Show a "Read-only guests" section listing active invites for the current Syndicate Admin's deals, with revoke action.

### 3. Scoping clarifications (no schema change required)
- `scopeDeals`/`scopeUsers`/`scopeDistributionLists` already correctly isolate per-org data — no change.
- Read-only guest access continues to flow through the existing `loginAsGuest` path; no role table changes.

## Out of scope
- No DB migrations (existing `guest_passcodes` table covers per-deal read-only access).
- No changes to Master Admin role logic.
- No RLS rewrite.
