# New Issue Board — Deal Focus Mode

Clicking anywhere on a deal row on the New Issue Board opens a dedicated full-screen view for that deal, with the deal list moving into the left column (replacing the main menu). Escape returns to the normal board.

## Behaviour

1. **Row click** — clicking any part of a row (except the chat icon and the inline headline/borrower editors, which keep their current behaviour) enters Focus Mode for that deal instead of expanding the row inline.
2. **Focus Mode layout** — full-viewport overlay:
   - Left column (same width/position as the app menu): compact, scrollable list of all deal headlines currently visible on the board (respecting the active Publish/Stage filters). Each entry shows borrower, headline, stage badge.
   - Right pane: the full deal detail — the same content the expanded row shows today (latest alert card, Update History, Deal Alert Data, AI Extract, Delete actions, chat).
3. **Active highlight** — the selected deal in the left list gets a bold yellow/amber border and background tint so it reads as "under selection". Clicking another entry switches the right pane without leaving Focus Mode.
4. **Escape** — exits Focus Mode and returns to the full New Issue Board with the app menu back on the left. Escape still first closes any open editor/modal/alert card (existing cascade preserved), so one Esc from a plain focused view returns to the board.

## Technical notes

- All work is in `src/pages/MessagesPage.tsx` (plus small styling additions if needed). No changes to `AppLayout.tsx` — Focus Mode renders as a `fixed inset-0 z-50` overlay above the app shell, so the menu is visually replaced without touching the layout component.
- New state: `focusedKey: string | null` (the existing `groupKey` = joined dealIds). Row `onClick` sets `focusedKey` instead of calling `toggleExpand`.
- The existing expanded-row JSX is extracted into a small `DealDetail` render helper reused by both the inline expansion and the Focus Mode right pane, so behaviour stays identical and there is no duplicated markup.
- Escape handling extends the existing keydown effect: skip while a Radix dialog is open or an alert card is expanded, otherwise clear `focusedKey`.
- Active-row styling uses existing amber/accent design tokens (`border-l-4` + ring in amber), no hardcoded colours.
- Left list is scroll-synced to the focused entry on open.
