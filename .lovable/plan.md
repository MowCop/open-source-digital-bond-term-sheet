## Goal
After login, guests land on the New Issue Board, can only navigate between New Issue Board and Deal Chat Box, and only see data for the deals they were pre-approved on.

## Changes

### 1. Routing (`src/App.tsx`)
- Wrap each non-guest route in a small `GuestBlock` that renders `<Navigate to="/messages" replace />` when `auth.guest` is set.
- Allowed for guests: `/messages` (New Issue Board) and `/inbox` (Deal Chat Box).
- Blocked for guests: `/`, `/deals`, `/ai-draft`, `/admin`, `/audit-log`, `/master-admin` → redirect to `/messages`.

### 2. Sidebar nav (`src/components/AppLayout.tsx`)
- Change the guest nav filter from `'/messages' | '/deals'` to `'/messages' | '/inbox'`.
- Hide everything else (already done by the `visibleNav` filter).

### 3. Post-login landing
- In `AuthPage` (or wherever post-login redirect lives), send guests to `/messages` instead of `/`. If logic already redirects to `from || '/'`, add a guest-aware override.

### 4. Data scoping for guests (`src/lib/scoping.ts` + consumers)
- Extend `ScopeContext` with `isGuest: boolean` and `guestDealIds: string[]`.
- Add `scopeMessages(messages, ctx)` and update `scopeDeals` so that when `isGuest` is true, only items whose `dealIds`/`id` intersect `guestDealIds` are returned.
- Update `useScopedApp()` in `AppContext.tsx` to pass guest info from `useAuth()`.
- `MessagesPage` and `InboxPage` already use `useScopedApp` — they will auto-filter once the helper is guest-aware. Chat channels in `InboxPage` filtered by deal id similarly.

### 5. Guest UX polish
- Hide the org badge in the header for guests (already partly done).
- Sidebar already shows "Guest · read-only" — keep.

## Out of scope
- No DB / RLS changes (scoping stays client-side, consistent with current pattern).
- No changes to the guest-login edge function or passcode model.
- No new pages.
