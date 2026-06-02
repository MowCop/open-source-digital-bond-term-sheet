## Undo AI Extraction (in-app rollback)

Add an in-app rollback so a Master Admin / Syndicate Admin can fully reverse an AI Extraction on any deal — deleting the extracted deal and restoring the original chat thread to its pre-extraction state. No code rollback, no project history involved.

### How it works for the demo

1. In **My Deal Chats**, click **AI Extraction** on the Kingdom of Narnia thread → a new Narnia deal is created in **Deal Data**.
2. Open the deal → header now shows an **Undo AI Extraction** button (only if the deal was created via extraction).
3. Click it → confirm dialog → deal is deleted, chat channel is unlinked from the deal and restored to its original alert-thread state, all chat messages get `dealId` cleared back to NULL, channel label restored to its pre-extraction label.
4. Demo is ready to run again from step 1.

### What gets captured & restored

When a deal is created via AI Extraction (the `if (sourceCh)` branch of `createDeal`), we snapshot the pre-extraction state of the source channel into a new `extraction_snapshot` JSONB column on `deals`:

- `sourceChannelId`
- previous `label`
- previous `participantIds`
- previous `dealId` (usually null)
- `extractedAt` timestamp
- `extractedBy` user id

On Undo:
- Restore `chat_channels` row: set `label`, `participant_ids`, `deal_id` back to snapshot values.
- Backfill `chat_messages` where `channel_id = sourceChannelId`: set `deal_id = snapshot.dealId` (NULL for the Narnia case).
- Delete the deal row + any deal-scoped notifications.
- Write `DEAL_EXTRACTION_UNDONE` audit log entry.

### Scope rules

- Button visible only when `deal.extractionSnapshot` exists (so existing/seeded deals don't show it).
- Visible to Master Admin and Syndicate Admin only.
- Confirmation modal lists what will happen ("Delete deal X, restore chat thread Y").
- If the deal has any sent messages/bulletins → block Undo with a tooltip ("Cannot undo: bulletins have been sent from this deal"). Avoids breaking audit trail.

### Files to touch

**Database (migration):**
- Add `extraction_snapshot JSONB NULL` column to `public.deals`.

**Backend helpers (`src/integrations/supabase/cloudData.ts`):**
- Extend `dealFieldMap` to include `extractionSnapshot` ↔ `extraction_snapshot`.
- No new RPC needed — Undo uses existing `updateChatChannel`, `updateChatMessagesByChannel`, `deleteDealRow`, `deleteNotificationsByDeal`.

**`src/types/bond.ts`:**
- Add `extractionSnapshot?: { sourceChannelId; previousLabel; previousParticipantIds; previousDealId; extractedAt; extractedBy }` to `Deal`.

**`src/context/AppContext.tsx`:**
- In `createDeal` `if (sourceCh)` branch: capture snapshot before mutating channel; store on new deal.
- Add new `undoExtraction(dealId)` action: validates snapshot, restores channel + messages, deletes deal + notifications, writes audit entry, updates local state.
- Expose `undoExtraction` via context.

**Deal header UI (likely `src/pages/DealsPage.tsx` deal detail view):**
- Add **Undo AI Extraction** button (destructive variant) next to title when `deal.extractionSnapshot` is set and user is admin and no sent messages exist.
- Confirm dialog → call `undoExtraction(deal.id)` → toast + navigate back to chat.

### Out of scope

- Per-field "undo just these fields" (full delete + restore only, per your choice).
- Undoing extractions on deals created before this migration (no snapshot stored).
- Time-limited undo window — available indefinitely while snapshot exists and no bulletins sent.
