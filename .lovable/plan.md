## User Management & New Issue Chat Overhaul

### 1. Rename "User Management" → "Address Book & User Admin"
- Update page title, sidebar nav label, route label, and breadcrumbs.
- Constant `UM_LABELS.pageTitle` and `AppLayout` nav item.

### 2. Edit User → User Roles dropdown
- Remove `master_admin` option from the dropdown shown to Syndicate Admins.
- Add new role `guest_readonly` ("Guest Read Only") to the `UserRole` type and `roleLabels`.
- Keep `master_admin` only assignable internally (not visible in the picker).

### 3. Edit User → "Deal Chats" panel (new, read-only)
- Below the global User Role dropdown, show a list of every New Issue chat this user is currently invited into, with deal name + stage.
- Global role field remains independently editable. Per-deal chat membership is informational only (driven by chat channel participants).

### 4. Syndicate Admin scoping (post-login)
- Syndicate Admin can only invite users to chats on **deals they created** (`createdByOrg` match). Already partially enforced via `scopeDeals`; extend to chat invite UI.
- Distribution Lists are managed inside Address Book & User Admin (already the case — confirm there is no "create list" entry point inside the Create New Issue flow itself; list selection only).

### 5. Distribution Lists vs Chat (separation of concerns)
- Clarify in UI copy: Distribution Lists grant **screen + deal data access only** — NOT chat access.
- Chat access is governed by a separate "Syndicate Chat Participants" (SCPs) selector on the New Issue form.
- Add help text on both controls in the Create New Issue screen.

### 6. Create New Issue → Syndicate Chat Participants (SCPs) selector
- New field on the Create/Edit New Issue form: **Syndicate Chat Participants**.
- Eligibility: any user with `category === 'Syndicate'` (internal or external) from the Address Book.
- Input: combobox with predictive search (type-ahead matching name, organization, email). Selected users render as removable chips.
- On deal save: auto-create a chat channel for the deal and seed `participant_ids` with the SCP selections (+ the creating Syndicate Admin).
- Allow creating additional separate chat channels for the same deal later (existing chat_channels table already supports multiple per deal_id).

### 7. Reset chat data
- Delete all rows in `chat_messages`. Keep `chat_channels` intact.

### 8. Seed dummy syndicate-only chats
- For every deal currently in an **active** stage (Mandate, Announcement, Bookbuilding, Pricing — i.e. not Settled/Withdrawn), generate a short realistic thread (5–8 messages) between syndicate users from that deal's bookrunner orgs only.
- No vendor, buyside, or guest senders.
- Reuse existing chat channel for the deal if one exists; otherwise create one.

### Technical notes
- Files touched: `src/pages/UserManagementPage.tsx`, `src/components/AppLayout.tsx`, `src/types/bond.ts` (add `guest_readonly`), Create/Edit New Issue form component(s) in `src/pages/DealsPage.tsx` and/or `src/pages/AIDraftPage.tsx`, `src/context/AppContext.tsx` (SCP → channel creation).
- DB: `supabase--insert` to wipe `chat_messages` and seed new ones; no schema changes required (chat_channels already supports per-deal channels with participant_ids).
- Audit log entries written for: SCP invitation, chat channel creation, dummy seed (tagged as system seed).
