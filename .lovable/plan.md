## Goal

Bring "The Kingdom of Nania/Narnia" deal back into **My Deal Chats** with its full 10-message chat thread (`cm_nania_001`…`cm_nania_010`), and fix the underlying bug so future Extract-from-Chat → Deal Data flows don't strand the chat history again.

## Current state (verified in DB)

- The 10 `cm_nania_*` chat messages still exist on `chat_messages`, but:
  - `chat_messages.deal_id` is **NULL** for every row
  - their `channel_id` (`ch_nania_alert`) no longer exists in `chat_channels`
  - the previously-created Narnia deal row (`d1780414513134`) is gone
- Result: the thread is invisible in My Deal Chats — it has no channel and no deal binding.

## Root cause

In `AppContext.createDeal(..., { sourceChannelId })` (src/context/AppContext.tsx ~L352-372), when an existing chat channel is re-linked to a newly-extracted deal, we update the **channel's** `dealId/label/participants`, but we never backfill `deal_id` onto the existing `chat_messages` rows in that channel. So when the deal is later deleted, `deleteChatMessagesByDeal(dealId)` filters by `deal_id` and skips those rows (they're still NULL), while `deleteChatChannelsByDeal(dealId)` removes the channel — leaving messages orphaned with a dangling `channel_id` and no deal binding. This is exactly what happened to the Nania thread.

## Fix — two parts

### Part A — Restore the Narnia deal + thread (data migration)

Single SQL migration:

1. INSERT a new `deals` row for "The Kingdom of Nania" (id `d_nania_restored`) with the priced terms visible in the chat (USD 1.5bn, 10Y, Priced, UST+195, etc.) and `bookrunners: []` (no extraction needed — these are the values the chat itself confirms).
2. UPSERT `chat_channels` row `ch_nania_alert` with `deal_id = 'd_nania_restored'`, `label = 'The Kingdom of Nania USD 1.5bn 10Y Priced at UST+195'`, `participant_ids = ["u1","u2","u3"]`.
3. UPDATE `chat_messages SET deal_id = 'd_nania_restored' WHERE id LIKE 'cm_nania_%'` so the 10 messages bind to the deal (Narnia-only, per your answer).
4. Audit log entry: `DEAL_RESTORED` for `d_nania_restored`.

Result in app: "The Kingdom of Nania" reappears in Deal Data, Issue Board and **My Deal Chats** with the full 10-message history intact.

### Part B — Stop future extractions from orphaning chat history

`src/integrations/supabase/cloudData.ts`
- Add helper: `updateChatMessagesByChannel(channelId, patch)` → `supabase.from('chat_messages').update(patch).eq('channel_id', channelId)`.

`src/context/AppContext.tsx — createDeal` (the `if (sourceCh)` branch ~L355-361)
- After re-linking the channel, also:
  - Locally: `setChatMessages(prev => prev.map(m => m.channelId === sourceCh.id ? { ...m, dealId: newDeal.id } : m))`.
  - Cloud: `updateChatMessagesByChannel(sourceCh.id, { deal_id: newDeal.id })` (fire-and-forget with error log).
- This guarantees every existing message in the source channel inherits the new `deal_id`, so the deal/channel/messages travel together for all future deletes, scoping queries and exports.

No changes to UI, AI extraction prompts, validation, or RLS.

### Out of scope

- Renaming "Nania" → "Narnia" (the mock seed uses "Nania"; leaving as-is to match the existing 10 messages — say the word and I'll rename in the same migration).
- Touching MBH or any other deal.
- Generator/edge-function changes.

## Files touched

- `supabase/migrations/<new>.sql` — restore deal + channel + rebind messages + audit row.
- `src/integrations/supabase/cloudData.ts` — add `updateChatMessagesByChannel`.
- `src/context/AppContext.tsx` — backfill `deal_id` onto source-channel messages in `createDeal`.
