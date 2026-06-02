## Global Search Panel

Add a persistent search bar across the top of every authenticated screen (inside `AppLayout` header) with live predictive-text suggestions across deals, alerts/messages, chats, and users — clicking a result jumps to the relevant page.

### Where it lives
- `src/components/AppLayout.tsx` header — replace the empty `<div />` (left side of header) with a wide search input. The header stays 12 units tall; the search input fills the available width up to ~640px, left-aligned.

### New component: `src/components/GlobalSearch.tsx`
- Controlled text input with `Search` icon (lucide) and `Cmd/Ctrl+K` keyboard shortcut to focus.
- Dropdown panel (Popover/Command from shadcn `cmdk`) appears as the user types (after 1 char), grouped by category:
  - **Deals** — match on issuer, ISIN, currency, tenor, stage; navigate to `/deals` with the deal pre-selected (or `/messages` deal context).
  - **New Issue Alerts** — match on subject/body; navigate to `/messages` and open that alert.
  - **Chats** — match on channel label and recent chat message text; navigate to `/inbox` opening that channel.
  - **People** — match on user name, email, organization; navigate to `/admin` (admins only).
- Each result row: icon + primary label + small muted secondary line (e.g. "Deal · EUR 7Y · Books Open"). Highlight matched substring.
- Empty state: "No matches" when query has no results; show a "Recent" list (last 5 viewed items via localStorage `bondvdr.search.recent`) when input is focused but empty.
- Debounce filtering at 120ms; cap each group at 5 results with a "Show more" expander.

### Data wiring
- Pull `deals`, `messages`, `chatChannels`, `chatMessages`, `users` from `useApp()` (already tenant-scoped, so guests and syndicate admins only search what they can see).
- Pure client-side filter — no backend changes. Case-insensitive substring + token match; rank exact issuer/ISIN matches first.

### Navigation behaviour
- Selecting a result calls `navigate(path)` and closes the panel. For deal/alert/chat results, pass the entity id via URL search param (e.g. `/messages?alert=m6`, `/inbox?channel=ch6`, `/deals?deal=d5`) so the target page can auto-focus it. Pages will read the param and scroll/open accordingly — minor additions to `MessagesPage`, `InboxPage`, `DealsPage`.

### Guest/role considerations
- Guests: search restricted to deals/alerts/chats they're a participant in (already handled by scoped context). People group hidden.
- Syndicate Admin: People group limited to own org.

### Out of scope
- No semantic/AI search — purely lexical predictive text on local state.
- No new backend tables or migrations.

### Files touched
- new: `src/components/GlobalSearch.tsx`
- edit: `src/components/AppLayout.tsx` (mount GlobalSearch in header)
- edit: `src/pages/MessagesPage.tsx`, `src/pages/InboxPage.tsx`, `src/pages/DealsPage.tsx` (read deep-link query param to auto-open target)
