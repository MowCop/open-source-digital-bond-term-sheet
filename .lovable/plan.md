## Goal

Make `Esc` cascade: first collapse the open alert card, then a second `Esc` collapses the parent deal row back to the Issue Board list.

## Current behaviour

- `MessagesPage.tsx` tracks the expanded deal via `expandedAlertId` and toggles it via the row chevron / row click.
- `AlertHistoryCard.tsx` already listens for `Esc` and collapses an expanded alert card (latest or otherwise).
- Once the alert card is collapsed, `Esc` does nothing — the deal row (Italy) stays expanded.

## Change

1. **Tag the expanded alert card** in `AlertHistoryCard.tsx` with `data-alert-card-expanded="true"` on the outer `<div>` whenever `expanded === true`. Used as the "is any inner card open?" sentinel.

2. **Add a window `keydown` listener in `MessagesPage.tsx`** that, on `Escape`:
   - Returns early if `expandedAlertId` is null.
   - Returns early if any open Radix Dialog is present (`document.querySelector('[role="dialog"][data-state="open"]')`) — let the modal own Esc.
   - Returns early if any alert card is still expanded (`document.querySelector('[data-alert-card-expanded="true"]')`) — let `AlertHistoryCard` collapse that first.
   - Otherwise sets `expandedAlertId = null`, collapsing the deal row back to the Issue Board view.

   Effect runs on `[expandedAlertId]` and cleans up on unmount.

## Verification

- Italy row expanded, Update #2 card expanded → press Esc → Update #2 collapses, Italy stays expanded.
- Press Esc again → Italy collapses back to the Issue Board list (matches screenshot 2).
- Edit modal open → Esc only closes the modal; deal row and cards unchanged.
- Esc with no deal expanded → no-op.
