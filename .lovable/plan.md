## Problem

On `Create New Issue`, the chat panel creates a `ChatChannel` via `ensureDraftChannel(draftKey, …)` with `dealId: undefined` — keyed only by the ephemeral `draftKey`.

When the user hits Save (`AIDraftPage.handleSave` / `handleSend`), a new `Deal` is created and a `Message` is stored against `deal.id`, but the draft chat channel is **never updated with that `dealId`**.

In `AlertHistoryCard` ("Edit alert"), the chat panel is `SecureChat` keyed on `message.dealIds[0]`, and `SecureChat` looks up channels by `dealId`. Since the draft channel still has `dealId: undefined`, nothing is found → "No messages yet."

## Fix

Attach the draft channel to the new deal at save/send time.

### Files to change

1. **`src/context/AppContext.tsx`**
   - Add `attachDraftChannelToDeal(draftKey: string, dealId: string, label?: string): void` to the context:
     - Look up channel id via `draftChannelIdsRef.current[draftKey]`. If none, no-op (user never opened/sent in chat).
     - Update local `chatChannels` state: set `dealId` (and optionally refresh `label`).
     - Call `updateChatChannel(channelId, { dealId, label })` to persist to Cloud.
     - Add an audit entry `CHAT_CHANNEL_UPDATED` describing the link.
   - Expose it in the context value alongside `ensureDraftChannel`.

2. **`src/pages/AIDraftPage.tsx`**
   - Pull `attachDraftChannelToDeal` from `useApp()`.
   - In `handleSave` and `handleSend`, **after** `createDealFromFields()` returns the deal, call `attachDraftChannelToDeal(draftKey, deal.id, headline)` (before/around `createMessage`).
   - In `handleSend` reset flow, also clear the local `draftChannelIdsRef` entry implicitly by regenerating `draftKey` on next mount (no extra work needed — the page already remounts a new key).

### Behavior after fix
- Save as Draft: the existing draft chat channel becomes the deal's channel. Reopening the draft via `Edit alert` shows the prior messages (e.g. "Can this be seen after saving as draft").
- Send: same — recipients/syndicate users keep the conversation against the published deal.
- If the user never typed in chat, no channel exists; Edit Alert behaves as before (empty chat ready for first message — `SecureChat` will create one on first send via `createDealChannel`).

### Out of scope
- Changes to `SecureChat`, `createDealChannel`, or the Edit Alert UI.
- Migrating already-orphaned draft channels from past sessions (those will remain unlinked).
