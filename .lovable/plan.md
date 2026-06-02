## Goal

The "Kingdom of Nania USD 10Y Sovereign — New Issue Alert" channel is a deal-related discussion that just hasn't had its deal record created yet (AI extraction is the next step). It should sit alongside the other deals on `/inbox` under **My Deal Chats**, not under a separate "General Conversations" section.

## Approach

Treat any chat channel without a `deal_id` as a "pending deal" row inside the same list as real deals on `InboxPage`. Drop the separate General Conversations section entirely.

Scope is frontend-only — no DB changes, no fake/stub `deals` row. The channel still has `deal_id: NULL`, and AI Extract on that thread will create the real deal when the user runs it.

## Changes — `src/pages/InboxPage.tsx`

1. **Merge orphan channels into the main list**
   - In `dealEntries`, also produce pseudo-entries for each orphan channel: `{ channel, pending: true }`.
   - Sort the combined list by most-recent chat activity (existing `sortBy` logic), so Kingdom of Nania interleaves with real deals naturally.

2. **New `PendingDealRow` component (or branch inside the map)**
   - Same Card shape as `DealRow` so it visually matches.
   - Header line uses the channel label as the title (e.g. "Kingdom of Nania USD 10Y Sovereign — New Issue Alert"), with a small **Pending — no deal yet** badge in place of the stage badge.
   - Shows "1 thread", unread count, last-message preview, and last-chat timestamp — identical to a real deal row.
   - Expanding renders the existing `ChannelThread` (which already includes the AI Extract button after the previous change).
   - Skips the "Alert Update History" block (no linked alerts to show).

3. **Remove the General Conversations section** (lines ~496–527).

4. **Search / counts**
   - Extend `matchesSearch` to also match pending rows by channel label or message content.
   - Include pending rows in the `visibleEntries.length` count shown in the header.

## Technical notes

- No migration. `chat_channels` row for Kingdom of Nania keeps `deal_id: NULL`.
- AI Extract on the channel still works as today — when run, it can create a real deal and the row will then render as a normal deal row keyed by `deal_id`.
- `ChannelThread` itself is unchanged.

## Out of scope

- Creating a placeholder `deals` row for Kingdom of Nania.
- Any backend / RLS / schema changes.
- The unrelated cosmetic issue where some chat bodies still render raw `<p>` / `<strong>` HTML as text (separate ticket).
