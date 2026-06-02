## Problem

In the Edit Alert split-screen, the right pane shows "Select a conversation" with no channel auto-selected for Republic of Italy.

`SecureChat` filters channels to `myChannels` (only those where `currentUser.id` is in `participantIds`). Italy's channel `ch1` only has `u2` (GlobalBank) and `u4` (Bloomberg) as participants. When the alert is opened by any other user (Master Admin, Syndicate Admin viewing as themselves, etc.), no channel matches → auto-select silently fails and the dropdown is empty.

## Fix

When `SecureChat` is rendered with `readOnly` AND an `activeDealId`, treat it as a contextual viewer:

1. Look up the channel(s) for `activeDealId` from the full `chatChannels` list (not `myChannels`), so admins viewing the bulletin can see the deal's thread regardless of channel membership.
2. Auto-select that channel on mount; if multiple channels exist for the deal, show them in the dropdown limited to that deal.
3. Hide the channel selector entirely when there is exactly one matching channel (cleaner read-only view).
4. If no channel exists for the deal, show "No chat thread for this deal yet" instead of the generic "Select a conversation" empty state.

This keeps the regular (non-read-only) chat behavior unchanged — normal users still only see their own channels.

## Files

- `src/components/SecureChat.tsx` — branch channel-source logic on `readOnly && activeDealId`; adjust auto-select effect, the `<Select>` options, and the empty-state copy.

No changes needed in `AlertHistoryCard.tsx` — it already passes `activeDealId` and `readOnly`.