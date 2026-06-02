# Chat strip on Create New Issue (headline-mirrored)

## What the user gets

The `Create New Issue` page (`/inbox` → AIDraftPage) gains a **full-width chat strip** directly under the page title. The chat title is the **same string** as the bulletin headline and updates live as the user types or as AI extraction fills it in. SCPs added in the right rail are the chat's participants.

```text
+--------------------------------------------------------------+
| Create New Issue                          [status pill]       |
| Draft a new message to auto-generate deal records.            |
+--------------------------------------------------------------+
| 💬  <headline mirrored here>           Participants: N  ⌃    |  <- collapsible strip
|     [ messages list — appears once chat exists ]              |
|     [ input row: textarea + paperclip + send ]                |
+--------------------------------------------------------------+
| Existing 2-col compose grid (unchanged)                       |
| Body editor + attachments | Recipients + SCPs                 |
+--------------------------------------------------------------+
```

## Behaviour

1. **Chat identity = draft headline.** A single ephemeral channel is associated with the draft. Its `label` is always equal to `headline` (empty headline → placeholder `"Untitled New Issue"`). Renaming the headline renames the chat in real time. The chat is not linked to a `dealId` until the draft is sent and promoted, at which point the existing `createDeal` flow attaches the channel id.
2. **Lazy creation.** No channel row is written until the first chat message is sent OR the draft is saved — whichever comes first. This avoids littering storage with empty chats from abandoned drafts. Until then the strip shows an empty state ("Start the conversation — chat will be created with the draft").
3. **Participants = SCPs + creator.** Reads from the existing `scpIds` state already on the page. Adding/removing an SCP in the right rail updates the chat's `participantIds` live (and emits chat-invite notifications for newly added SCPs once the channel exists, matching `createDeal` semantics).
4. **Collapsible.** Strip opens by default; chevron collapses to a one-line summary `💬 <headline> · N participants · M messages`. Collapse state persisted in `localStorage` (`bondvdr.aiDraft.chatOpen`).
5. **Headline source unchanged.** Headline still comes from manual input, AI document-drop extraction, or chat extraction — chat strip just mirrors it.
6. **Permissions.** Only `master_admin` / `syndicate_admin` (current draft-author roles) see and use the chat strip. Vendor users never reach this page.
7. **No schema changes.** Uses the existing `ChatChannel` type (`dealId?` already optional) and the existing `sendChatMessage` / `chatChannels` state in `AppContext`.

## Files to change

- **`src/pages/AIDraftPage.tsx`**
  - Add a `<DraftChatStrip />` between the title block and the existing `grid grid-cols-3` compose grid.
  - Pass `headline`, `scpIds`, `setScpIds` (read-only here), and a `draftKey` (stable per mount, e.g. `useMemo(() => 'draft-' + Date.now())`).
  - On Save/Send, hand `draftChannelId` to `createMessage` / `createDeal` so it can be attached to the resulting deal.

- **`src/components/DraftChatStrip.tsx`** (new)
  - Self-contained strip: header row (icon + mirrored headline + participant badge + collapse chevron), scrollable message list, input row.
  - Reads `chatChannels`, `chatMessages`, `currentUser`, `users`, `sendChatMessage` from `useApp()`.
  - Maintains `channelId` in a `ref` + local state. Creates the channel via a new `ensureDraftChannel(draftKey, label, participantIds)` helper in `AppContext` the first time a message is sent.
  - On `headline` change while a channel exists, calls `renameChatChannel(channelId, headline || 'Untitled New Issue')`.
  - On `scpIds` change while a channel exists, calls `updateChatChannelParticipants(channelId, [currentUser.id, ...scpIds])`.

- **`src/context/AppContext.tsx`**
  - Add three helpers (small, ~15 lines each, persisted via existing `insertChatChannel` / a new tiny `updateChatChannel` cloud helper):
    - `ensureDraftChannel(draftKey: string, label: string, participantIds: string[]) → ChatChannel`
    - `renameChatChannel(id: string, label: string)`
    - `updateChatChannelParticipants(id: string, ids: string[])` — diffs and fires `chat_invite` notifications for newly added SCPs (reusing the pattern in `createDeal`).
  - Expose all three on the context value + `AppContextType`.

- **`src/integrations/supabase/cloudData.ts`**
  - Add `updateChatChannel(id, patch: Partial<Pick<ChatChannel,'label'|'participantIds'|'dealId'>>)` that does an `update` on the chat channels table by id. (Used by the three helpers above and by `createDeal` to attach `dealId` when a draft is promoted.)

- **`.lovable/plan.md`** — short note that the draft chat strip is delivered; the deferred items list is unchanged.

## Technical details

- The `draftKey` is the React-component-lifetime identifier used to find/create the right ephemeral channel; once a real channel id exists, the strip uses that. After a Save (which navigates to MessagesPage) the strip unmounts; on re-opening the saved draft, the AIDraftPage already has the related `messageId` and we can look up the channel by `dealId` (post-promotion) or by `label === headline` fallback for pre-deal drafts.
- Live mirroring uses a debounced (200ms) effect on `headline` so rapid typing doesn't spam channel updates.
- Audit: every channel rename and participant change writes an `audit_log` entry (`CHAT_CHANNEL_UPDATED`).
- No realtime/AI behaviour from earlier iterations is touched.

## Out of scope (call out)

- Promoting a draft → deal and re-binding the channel to `dealId` is implemented for the happy path (the existing `createDeal` call from AIDraft) but **not** retrofitted to other deal-creation entry points.
- Multi-tab editing of the same draft is not synced (current behaviour).
- No new edge functions, no schema/migration changes.
