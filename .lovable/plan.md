# Friendly exits from Edit alert modal

Make it easy to return to the Main Issue Board from the Edit alert panel without saving, while protecting unsaved work.

## Changes (src/components/AlertHistoryCard.tsx)

1. **Track dirty state**
   - Compute `isDirty = editSubject !== message.subject || editBody !== message.body`.
   - Wrap close logic in `attemptClose()` that returns early via `window.confirm("You have unsaved changes. Discard and return to the Issue Board?")` when `isDirty`; otherwise calls `handleCancel()`.

2. **Click outside the modal closes it**
   - Already wired via `Dialog onOpenChange` (overlay click + X button both fire it). Replace the current `if (!o) handleCancel()` with `if (!o) attemptClose()` so the confirm prompt runs.

3. **Esc key closes it**
   - Radix Dialog already closes on Esc through the same `onOpenChange` path, so the change in step 2 covers it automatically. No extra key handler needed.

4. **"Back to Issue Board" link in the header**
   - In `DialogHeader`, add a small left-aligned button above the title: `← Back to Issue Board` (ghost variant, `text-xs text-muted-foreground hover:text-foreground`).
   - `onClick={attemptClose}`.

5. **Cancel button**
   - Route through `attemptClose` as well, so all four exit paths (X, overlay, Esc, Cancel, Back link) behave consistently.

## Verification

- Open an alert → Edit alert modal opens.
- With no edits: click overlay / press Esc / click X / Cancel / Back link → modal closes immediately, returns to Issue Board.
- With edits to subject or body: each of the five exit paths shows the confirm prompt; Cancel keeps the modal open, OK discards and returns.
- Save and Save & Send still work and bypass the prompt (they explicitly close after persisting).
