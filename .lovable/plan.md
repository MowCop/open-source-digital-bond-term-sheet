## Goal

Move the "Deal Chat" entry point out of the action-button row inside the expanded panel and surface it on every collapsed Issue Board row as a compact, always-visible box sitting immediately next to the expand chevron.

## Current behaviour

- The Issue Board row is a 12-column grid: chevron (1) · Last Updated (2) · Borrower (2) · Headline (4) · Bookrunners (2) · Stage (1).
- To reach the deal's chat, the user must expand the row, then click a "Deal Chat" `Button` (rendered twice — once in the history action bar, once in the default action bar in `MessagesPage.tsx`).
- This hides chat behind an extra click and duplicates the control.

## Proposed change

### 1. New "Chat" column next to the chevron

Re-balance the 12-column grid so a dedicated chat cell sits at position 2:

| col-span | Content |
|---|---|
| 1 | Chevron (▸ / ▾) |
| 1 | **Chat box (new)** |
| 2 | Last Updated |
| 2 | Borrower |
| 3 | Headline *(reduced from 4)* |
| 2 | Bookrunners |
| 1 | Stage |

Headline already truncates, so dropping one column is safe at the current viewport. Add the matching `<div className="col-span-1">Chat</div>` cell in the header row.

### 2. The chat box itself

A small, button-like square (≈28×28) using existing tokens — not a full text button:

- Icon: `MessageSquare` from lucide.
- Visual: rounded border, `bg-card`, `hover:bg-accent` ring; matches Stage badge weight so it reads as a row-level affordance, not a primary CTA.
- Unread indicator: if the deal has unseen chat messages, overlay a small `bg-destructive` dot (top-right) with the count when >0. Reuse the same unread logic already used on the Inbox page (`chatMessages` newer than a per-channel `lastSeen` timestamp) so badges stay consistent across the app.
- Tooltip / `title`: "Open Deal Chat" (or "Open Deal Chat — N unread").
- Click: `e.stopPropagation()` then call the existing `handleOpenChat(group.dealIds)` — so it works whether the row is collapsed or expanded, and it never toggles expand.
- Keyboard: `tabIndex=0`, Enter/Space activates; focus ring uses `ring-ring`.

### 3. Remove the now-redundant in-panel buttons

Delete both "Deal Chat" `<Button>` instances inside the expanded panel (the one in the history action bar at ~L600 and the duplicate in the default action bar at ~L672). The new row-level box replaces them, which also resolves the long-standing "Deal Chat appears twice when expanded" duplication.

"Deal Alert Data", "Update History", "Edit Latest", and "Delete" stay where they are.

### 4. Active-chat highlight

When `showChat === true` and `activeDealId` belongs to this group, render the box in the filled/active state (`bg-primary text-primary-foreground`) so the user can see which row the open right-hand chat panel belongs to.

## Files touched

- `src/pages/MessagesPage.tsx` — grid header + row layout, new ChatCell, remove duplicate buttons, wire active-state styling.
- (Optional, only if needed for unread counts) small selector helper near the existing `chatMessages` access; no schema or context changes.

## Out of scope

- No change to `SecureChat`, channel model, or chat persistence.
- No change to Esc / double-click panel-close behaviour.
- No change to InboxPage (it already has its own unread treatment).