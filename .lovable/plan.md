## Scope
On `/inbox` (My Deal Chats), add a sort control with two modes and show the corresponding timestamp on each deal row.

## Changes — `src/pages/InboxPage.tsx` only

### 1. Sort toggle (header area, next to the deal count)
Small segmented control:
- **Last Chat** (default) — newest chat message timestamp across the deal's channels (current behaviour)
- **Last Updated** — `deal.updatedAt` (covers stage changes, alert posts, AI parse merges, participant edits)

State: `const [sortBy, setSortBy] = useState<'chat' | 'updated'>('chat')`, persisted to `localStorage` under `bondvdr.inbox.sortBy` so the choice sticks per browser.

### 2. Sort logic
Replace the existing inline sort in `dealEntries` useMemo:
```
const ts = sortBy === 'chat'
  ? (chs) => max(0, ...chatMessages where channel in chs).timestamp
  : (_chs, deal) => deal.updatedAt.getTime();
entries.sort((a, b) => ts(b.channels, b.deal) - ts(a.channels, a.deal));
```
Same comparator drives `orphan` channels (orphans have no deal → fall back to last chat).

### 3. Per-row timestamp
In `DealRow` header, replace the existing small timestamp shown under the preview line with a right-aligned label that reflects the current sort:
- Last Chat mode: `Last chat: 11 May, 14:32` (or `Today HH:mm` / `Yesterday` via existing `formatTime`)
- Last Updated mode: `Updated: 11 May, 14:32`

If the deal has no chat messages yet and Last Chat is selected, show `Last chat: —`. `Updated` always has a value.

Pass `sortBy` into `DealRow` as a prop so the label switches in sync.

### 4. Orphan "General Conversations"
Add the same timestamp line under each orphan row (`Last chat: …`). Orphans don't have a deal, so Last Updated falls back to last chat for them.

## Out of scope
- No new DB fields. `deal.updatedAt` already exists and is bumped by `updateDeal` / `updateDealStage`.
- No changes to the chat itself, message ordering inside a thread, or notifications.
- No ascending/descending toggle — both modes are newest-first.
- No filter UI changes beyond the sort control.