## Goal

Make the chat surface consistent between the **New Issue Board** and the (renamed) **My Deal Chats** page, ensure every newly-created New Issue has a chat channel that flows through to both views, and wire chat-invite notifications to the top bell.

## Changes

### 1. `src/pages/InboxPage.tsx` — rename + helper text + invite badge

- Rename the page header from **Deal Chat Box** to **My Deal Chats**.
- Add a small muted note just above the search input:
  *"Showing only chats you are a member of. New invites appear in the bell above."*
- No change to scoping — the page continues to list only deals where `currentUser.id ∈ channel.participantIds` (per the user's preference).
- Inside each expanded deal row, render the **alert Update History** alongside the existing chat thread:
  - Above the channel messages, add a collapsible section *"Alert Update History (N)"* that lists each message version (Original / Update #n) with timestamp, headline and body — same data already shown on the New Issue Board's expanded row, sourced from `messages.filter(m => dealIds.includes(deal.id))` ordered newest-first.
  - Keep the chat thread itself unchanged below it, so users see both the dispatched alerts and the live chat in one place.

### 2. `src/components/SecureChat.tsx` and `src/pages/MessagesPage.tsx` — same data, no behavioural change

Both already read from the shared `chatChannels` / `chatMessages` state, so the chat thread shown inside the New Issue Board (`SecureChat`) and inside My Deal Chats is the same data. The only effective difference today is presentation — Update History is on the Board but not in the Chat Box. Change #1 closes that gap. No code changes in `SecureChat` itself.

### 3. Chat-invite notification flow (bell)

When a Syndicate Admin adds a Syndicate Chat Participant to a deal's channel (either at `createDeal` time via `scpIds`, or later via the existing participant editor), emit a notification of a new type `chat_invite`:

- `title`: *"Chat invite: {issuerName} {ccy} {tenor}"*
- `body`: *"You've been added to the deal chat. Open My Deal Chats to join."*
- `dealId` set; `read=false`.

Locations to wire this:
- `src/context/AppContext.tsx` → inside `createDeal`, after building `newChannel`, push one notification per `scpId` (excluding the creator).
- `src/context/AppContext.tsx` → wherever channel participants are mutated post-creation (search for `setChatChannels(prev => prev.map`); emit a notification for each newly-added participant id.

Add `'chat_invite'` to the `Notification['type']` union in `src/types/bond.ts`.

### 4. Bell highlight for unaccepted invites

- `src/components/AppLayout.tsx` already shows `unreadCount` from `notifications`. Add a secondary state: if any unread notification has `type === 'chat_invite'`, render the bell icon in `text-primary` (instead of `text-muted-foreground`) and keep the destructive count badge. This makes pending invites visibly distinct without adding a separate UI surface.
- Clicking the bell navigates to `/inbox` (My Deal Chats). On arrival, mark all `chat_invite` notifications as read via the existing `markNotificationRead`. No accept/reject flow — once a user is added as a participant they are already in the channel; the notification just surfaces it.

### 5. Side-nav label

- Update the sidebar entry in `src/components/AppLayout.tsx` from **Inbox** / **Deal Chat Box** to **My Deal Chats** for consistency.

## Technical notes

- Participants policy stays **Creator + SCPs only** as confirmed. Alert recipients are *not* added to chat channels.
- No DB schema changes. `notifications` table already supports the new type (`type` is `text`).
- Realtime: notifications already replicate through the existing Supabase subscription; new `chat_invite` rows will live-update the bell.
- Audit log: emit a `CHAT_PARTICIPANT_ADDED` entry alongside each invite notification.

## Out of scope

- Accept/decline UX for chat invites (auto-joined on add).
- Changes to recipients / distribution lists.
- Any new pages or new chat channels beyond the per-deal channel that already exists.
