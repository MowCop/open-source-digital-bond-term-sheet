## Objective
Make each historical update in the New Issue Board's "Update History" tab show only a compact headline by default. Clicking the headline expands to reveal the full update content. Clicking again collapses it back.

## Changes

### File: `src/components/AlertHistoryCard.tsx`
- Add a local `isOpen` state (default `false`) to each card.
- Wrap the existing header row in a clickable trigger with hover styling and a chevron icon (`ChevronRight` collapsed / `ChevronDown` expanded).
- Conditionally render everything after the header (body, distribution list, attachments, action buttons) only when `isOpen === true`.
- Ensure edit mode still works: when entering edit mode, auto-expand the card so the full form is visible.

## How It Works
Each `AlertHistoryCard` becomes self-managing:
```
┌─ [>] Original · Apple Inc. USD 10Y New Issue Alert          sent  ─┐  ← collapsed
├─ [v] Update #1 · Apple Inc. USD 10Y — Priced                sent  ─┤  ← expanded
│   Body: Apple Inc. has priced its USD 3bn 10Y Green Bond...
│   Distribution (12 recipients)
│   Attachments (2)
│   [Edit] [Retract] [Delete]
└─────────────────────────────────────────────────────────────────────┘
```
- The parent `MessagesPage.tsx` requires **no changes** — the existing list mapping stays identical.
- The existing `Collapsible` import in `AlertHistoryCard.tsx` is already available if we want to use it, but local state with conditional rendering is simpler and keeps the animation frame-independent.

## Acceptance Criteria
- [ ] All historical updates render as compact clickable headlines when the "Update History" tab is opened.
- [ ] Clicking a headline expands that specific update to show body, recipients, attachments, and actions.
- [ ] Clicking the same headline again collapses it.
- [ ] Entering edit mode auto-expands the card.
- [ ] No regression in edit/retract/send/delete flows.