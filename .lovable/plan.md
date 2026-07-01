## Problem
Victor Tango was created successfully (address-book row in `public.users`), but the Users tab is split into two stacked tables with no headings and no sort, so a newly-added row appears at the bottom of the lower table and looks missing.

## Fix

### 1. `src/pages/UserManagementPage.tsx` — Address Book table
- Sort `users` by `createdAt` **descending** so newly added rows appear at the top.
- Add a clear section heading above the existing table: **"Address Book (manually added contacts)"** with a one-line subtitle: "Contacts you add here appear in distribution lists and message recipients. They do not create login accounts."
- After `handleCreateUser` succeeds, briefly highlight the new row (background flash for ~2s) so it's obvious where it landed.

### 2. `ApprovedUsersSection.tsx` heading
- Rename to **"Approved Login Users (self-registered)"** so the distinction from the Address Book table is obvious at a glance.

### 3. No schema or auth changes
- Add User continues to write only to `public.users` (address book). No `user_roles` row, no auth account — same behaviour as today, just made visible.

## Out of scope
- Turning address-book contacts into login users (that's the existing sign-up + approval flow).
- Merging the two tables — they represent different things (contacts vs. login accounts) and should stay separate.
