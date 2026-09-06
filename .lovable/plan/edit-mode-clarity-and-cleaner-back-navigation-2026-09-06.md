# Edit-mode clarity and cleaner back-navigation

## Goal
Make it obvious that the deal screen is in Edit mode, and remove the standalone `Main Menu` row so navigation back to the board lives in the top toolbar instead.

## Proposed changes

1. **Remove the dedicated Main Menu row**
   - Delete the `DialogHeader` row in `src/components/AlertHistoryCard.tsx` that currently contains the `<ArrowLeft /> Main Menu` button (lines ~803-813).
   - This frees vertical space and avoids a lone navigation row between the toolbar and the update label.

2. **Add a back-to-board button inside the top toolbar**
   - Place a square icon-only button at the far left of the function-icon toolbar, before Chat.
   - Use `ArrowLeft` with tooltip `Back to Main Menu`.
   - Clicking it runs the existing dirty-check confirmation and `navigate('/messages')` logic currently in `handleBackToMenu`.
   - Keep it visually distinct from the function icons (e.g. muted/outline style rather than the action orange border).

3. **Add a clear Edit-mode indicator**
   - Add an `Edit` badge/pill in the top toolbar near the left side (after the back button or near the action group) with text `Edit Mode` or `Editing`.
   - Use a noticeable but non-alarming style, e.g. a small amber or primary badge, so users immediately understand the screen state.
   - Alternatively, change the modal’s top border or header tint to indicate edit state; the badge is the primary signal.

4. **Preserve existing behavior**
   - Keep the toolbar order and icon-only square styling for Chat, AI DataParse, Deal Checker, OrderBook, Docs, Save, Save & Send, Retract.
   - Keep the borrower name centered in the toolbar row and the timestamp at the far right.
   - Keep the centered bright-blue version label row and the yellow headline row unchanged.
   - Dirty-change confirmation before navigating away remains in place.

## Out of scope
- No changes to Save/Save & Send/Retract behavior or placement.
- No changes to the New Issue Board layout.
- No changes to chat, AI parsing, Deal Checker, or attachments functionality.

## Verification
- Typecheck passes.
- Playwright confirms the toolbar contains the new back button, the `Main Menu` row is gone, and the Edit-mode indicator is visible.
