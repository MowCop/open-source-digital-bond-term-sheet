## Problem

Today's "Delete" on the New Issue Board only removes the **messages** for that deal — the Deal record itself (and its chat channel, chat messages, and notifications) stays in the database. That's why the duplicate Kingdom of Thailand row still appears on My Deal Chats and likely on Deals/Audit/Notifications too.

Root cause: there is **no `deleteDeal` function anywhere** in `AppContext` or `cloudData`. `handleDeleteThread` in `MessagesPage.tsx` calls `deleteMessageThread(dealIds)` which only purges `messages` rows.

## Fix — make Delete a true cascade

Add a single `deleteDeal(dealId)` function in `AppContext` that removes every trace of a deal from the platform, and wire the New Issue Board's "Delete" action to it.

### 1. `src/integrations/supabase/cloudData.ts`
Add three new helpers:
- `deleteDealRow(id)` → `delete from deals where id = id`
- `deleteChatChannelsByDeal(dealId)` → delete from `chat_channels` where `deal_id = id`
- `deleteChatMessagesByDeal(dealId)` → delete from `chat_messages` where `deal_id = id`
- `deleteNotificationsByDeal(dealId)` → delete from `notifications` where `deal_id = id`

(Messages are already keyed by `deal_ids` jsonb array — reuse existing `deleteMessagesByDealKey`.)

### 2. `src/context/AppContext.tsx`
Add `deleteDeal(dealId)`:
1. Remove from local state: `deals`, `messages` (any row whose `dealIds` includes id), `chatChannels`, `chatMessages`, `notifications`.
2. Fire-and-forget Supabase deletes for each of those tables (deal row + channels + chat msgs + notifications + messages-by-deal).
3. Emit `DEAL_DELETED` audit log entry (`entityType: 'deal'`, `entityId: dealId`, details = issuer/ccy/tenor + count of cascaded rows).
4. Expose on the context value.

### 3. `src/pages/MessagesPage.tsx`
Change `handleDeleteThread` to call `deleteDeal(dealId)` for each `dealId` in the group (in addition to / instead of `deleteMessageThread`). Update the confirm copy:

> "Delete the entire deal '{borrower}' including {N} alert(s), its chat history, and all related notifications? This cannot be undone."

Toast: *"Deal Deleted — Kingdom of Thailand and all related data removed."*

### 4. Consistency check across the app
After the cascade, these views automatically clear because they all derive from the same state:
- `InboxPage` (My Deal Chats) — filters by `chatChannels` / `deals`
- `DealsPage` — derives from `deals`
- `AppLayout` bell — filters notifications by deal
- `AuditLogPage` — will show the new `DEAL_DELETED` entry
- `MessagesPage` (New Issue Board) — already keyed on messages

No additional view-level changes required, but I'll spot-check each page to confirm there are no lingering `useMemo` snapshots keyed only on `messages`.

### 5. One-off cleanup of the existing orphan
The duplicate Kingdom of Thailand deal currently in the DB has no messages but still has a `deals` row (and possibly `chat_channels`/`chat_messages`/`notifications`). After the code change ships, I'll run a targeted cleanup via the insert tool:

```sql
-- Identify the orphan first (read-only check), then:
DELETE FROM chat_messages   WHERE deal_id = '<orphan deal id>';
DELETE FROM chat_channels   WHERE deal_id = '<orphan deal id>';
DELETE FROM notifications   WHERE deal_id = '<orphan deal id>';
DELETE FROM deals           WHERE id      = '<orphan deal id>';
```

I'll first query `deals` for both Kingdom of Thailand rows and confirm with you which `id` to delete before running the cleanup.

## Out of scope
- No schema changes (no FK cascades added — handled in app layer to keep audit/realtime hooks in one place).
- No change to message-only retract/delete flows on individual alert versions.
- No change to participants policy or chat invite flow.

## Open question
Should "Delete" on the New Issue Board always delete the **whole deal** (current proposal), or should we offer two distinct actions — "Delete alerts only" vs "Delete entire deal"? I've assumed one consolidated Delete = full cascade, since the duplicate-deal problem you raised needs that. Let me know if you want both options instead.