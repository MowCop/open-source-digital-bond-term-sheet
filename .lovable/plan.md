

## Plan: Threaded Metadata-Linked Alert System

Transform the Messages section into a deal-centric threaded system where messages (alerts/updates) are tightly coupled with their deal's chat thread, with stage-aware styling and automated bot bridging.

### What changes

**1. Stage-specific color coding on message cards and subjects**
- Add color-coded stage badges/prefixes to message list items based on the deal's current stage:
  - Mandate: Blue, Marketing/Launch: Green, Books Open/Closed: Green, Priced/Settled: Red/Gold
- Dynamic headline prefixes: e.g. `[BOOKS OPEN] Republic of Italy EUR 10Y`
- Apply to both the message list cards and the detail view header

**2. "Join Chat" deep-link button on message detail**
- When viewing a message, add a "Join Chat" button that automatically switches the SecureChat panel to the matching deal's chat channel (or creates one if needed)
- The SecureChat component will accept an optional `activeDealId` prop to allow external navigation

**3. Deal-centric chat threading (Master Thread per deal)**
- Auto-create a chat channel per deal at Mandate stage (update `createDeal` in AppContext)
- Chat channels are keyed by `dealId`; the channel selector in SecureChat groups by deal
- When a message is selected, the chat panel auto-filters to that deal's thread

**4. Automated "Bridge" bot posts**
- When a message is sent (`sendMessage`), automatically post a bot summary into the deal's chat channel with a "Discuss Now" label
- Bot messages use a distinct `senderType: 'system'` styling (neutral color, bot icon)

**5. Synchronized selection (Messages ↔ Chat)**
- Selecting a message in the left panel auto-switches the chat to the corresponding deal thread
- Add a `selectedDealId` state lifted to `MessagesPage` and passed to `SecureChat`

### Files to modify

- **`src/types/bond.ts`** — Add `'system'` to `senderType` union on `ChatMessage`
- **`src/context/AppContext.tsx`** — Update `createDeal` to auto-create a chat channel; update `sendMessage` to post bot bridge message into the deal's chat thread
- **`src/components/SecureChat.tsx`** — Accept `activeDealId` prop to auto-select channel; support `system` sender styling; show deal stage badge in header
- **`src/pages/MessagesPage.tsx`** — Add stage color coding to message cards; add "Join Chat" button in detail view; pass `selectedDealId` to SecureChat on message selection; add dynamic `[STAGE]` headline prefixes
- **`src/data/mockData.ts`** — Add bot bridge messages to existing mock data; ensure every deal has a corresponding chat channel

### Stage color mapping (used in message cards and chat)

```text
Mandate          → blue    (bg-blue-100 text-blue-800)
Announced        → blue
Launched         → green   (bg-green-100 text-green-800)
Books Open       → green
Books Closed     → green
Priced           → red/gold (bg-amber-100 text-amber-800)
Settled          → red/gold
```

### No changes to routing or data model structure beyond the additions noted above.

