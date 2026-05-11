## Goal

On the New Issue Board, simplify the alert edit panel so it offers two clear actions side-by-side — **Save** and **Save & Send** — and surface every prior sent version as a timestamped, expandable Update History under each New Issue. The deal's chat room is unaffected by edits or new versions.

## Changes

### 1. `src/components/AlertHistoryCard.tsx` — unified edit panel

Today the card has two separate edit modes: **Edit** (shows `Save Changes`) and **Post Update** (shows `Save as New Update`). Replace with a single edit mode that shows both buttons on the same panel:

- **`Save`** — silent in-place update via `onUpdate`. No new history entry. Same status. (Renamed from `Save Changes`.)
- **`Save & Send`** — calls `onPostUpdate`, which now creates a new versioned message AND sends it immediately in one click. New timestamped entry appears at the top of Update History. (Renamed from `Post Update` / `Save as New Update`.)
- **`Cancel`** — unchanged.

Remove the standalone top-level **Post Update** button. The single **Edit** entry point opens the unified panel with both actions. Draft messages keep their existing `Send` button; retracted messages stay read-only.

Small header polish: prefix the timestamp with the version label so each card reads as a time-stamped revision (e.g. `Original · May 11, 09:42 AM`, `Update #2 · May 11, 02:15 PM`).

### 2. `src/pages/MessagesPage.tsx` — auto-send new version

Update `handlePostUpdate` so that after `createMessage(... status: 'draft' ...)` it immediately calls `sendMessage(newDraft.id)`. Toast becomes "Update Sent" with recipient count. Existing deal-merge and stage-forward logic stays as-is.

Rename the expanded tab from `Alerts History (N)` to `Update History (N)`.

### 3. Per-issue expandable Update History

The version list already exists in the row's expanded panel (`AlertHistoryCard` per message, newest first, with `Original` / `Update #n` chips). After change #2, every **Save & Send** automatically appends a new sent, timestamped entry — giving the requested expandable, time-specific history with no extra wiring. **Save** never adds an entry, so history reflects only dispatched updates.

### 4. Chat room

No changes. `SecureChat` and the deal's `chat_channels` row are keyed off `dealId`, independent of message versions, so edits/new versions don't touch the chat thread.

## Technical notes

- Files edited: `src/components/AlertHistoryCard.tsx`, `src/pages/MessagesPage.tsx`.
- No DB schema, RLS, edge function, or dependency changes.
- Audit log: `createMessage` + `sendMessage` already write entries, so Save & Send produces a normal audit trail per dispatch.

## Out of scope

- Distribution list / SCP / role changes.
- Chat schema or UI.
- Recipient editing during Save & Send (reuses the original message's recipients, same as today).