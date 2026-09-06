# Remove Focus Mode; jump straight from board to edit/archive overlay

## Goal
Eliminate the intermediate Focus Mode deal-detail view. Users navigate only between the New Issue Board and a full-screen edit/archive overlay: the latest sent update opens in edit mode; older sent updates open read-only.

## What will change

### 1. Remove the Focus Mode overlay
- Delete the full-screen overlay in `src/pages/MessagesPage.tsx` that renders the left-hand deal list and the yellow-bordered detail panel (`focusedKey` overlay).
- Remove supporting Focus Mode state and effects: `focusedKey`, `overlayRef`, `returnFocusRef`, `activeListItemRef`, focus-trap and restore-focus logic, and the `openFocus` helper.
- Keep the board itself intact.

### 2. New full-screen edit/archive overlay
- Add a new overlay state driven by the message currently being edited/viewed (e.g. `editMessageId` / `archiveMessageId`).
- When a user clicks anywhere on a board row, open the overlay for the most recently **sent** update of that deal in **edit** mode (same `openTargetId` rule already used today).
- When a user clicks an older version in the expanded row, open that specific message in **read-only** archive mode.
- The overlay renders a single `AlertHistoryCard` at full width/height with `embedded={false}` (or a new `fullscreen` prop) so it carries its own header, version dropdown, borrower title, timestamp, and toolbar.
- A back arrow at the top-left of the overlay returns to the New Issue Board (same dirty-change confirmation already used in `AlertHistoryCard`).

### 3. Preserve expanded row on the board
- Keep the chevron expansion and the list of Original / Update #N entries.
- Clicking an older version item opens the archive overlay read-only.
- Clicking the main row opens the latest sent update in edit mode.

### 4. Keep edit-screen version dropdown
- Inside the overlay, the existing version dropdown continues to list all sent versions newest-first.
- Selecting the current version keeps edit mode; selecting an older version switches to read-only archive mode.

### 5. Preserve all existing functionality inside the overlay
- Top function toolbar: Edit Latest, Chat, AI DataParse, Deal Checker, OrderBook, Docs, Save, Save & Send, Retract.
- Draggable/resizable chat panel, attachment panel, AI Deal Checker panel, AI DataParse popover.
- Save keeps the current update number; Save & Send advances it.
- Dirty-change confirmation when navigating back.

### 6. Clean-up
- Remove any now-dead Focus Mode CSS/classes if they exist.
- Update keyboard shortcuts so `E` and row-click open the overlay directly.
- Ensure Esc from the overlay returns to the board.

## Files to touch
- `src/pages/MessagesPage.tsx` — remove Focus Mode, add new overlay state and open logic.
- `src/components/AlertHistoryCard.tsx` — ensure it renders cleanly in fullscreen/overlay mode; confirm read-only archive behavior and back navigation.
- `src/index.css` — remove any orphaned Focus Mode styles.

## Verification
- TypeScript typecheck passes.
- Playwright: clicking a board row opens the latest update in edit overlay; clicking an older version opens read-only archive overlay; back arrow returns to board; expanded row still works; Save/Save & Send/Retract remain functional.
