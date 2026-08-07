# Hover-to-select deals on the New Issue Board

Selection follows the cursor: no click needed to pick a deal, on the board and inside Focus Mode.

## Behaviour

1. **Board rows** — hovering a deal row on the New Issue Board opens Focus Mode for that deal automatically. Moving to another row switches the focused deal.
2. **Focus Mode left list** — hovering an entry in the left headline column switches the right pane to that deal immediately (click still works).
3. **Guard against accidents** — hover only triggers after the cursor rests on a row for a short moment (~200ms), so sweeping the mouse across the board doesn't flip through every deal. Leaving a row cancels the pending switch.
4. **Nothing else changes** — Escape still exits Focus Mode, inline editors (headline/borrower), the chat icon and the expand chevron keep their current click behaviour, and keyboard arrow navigation still works.
5. **Keyboard wins over hover** — if the user is navigating with arrow keys, hover is ignored until the mouse actually moves again, so the selection doesn't jump under the cursor.

## Technical notes

- All changes in `src/pages/MessagesPage.tsx`.
- Add `onMouseEnter` / `onMouseLeave` on the board row wrapper and on the Focus Mode list entries, driving the existing `setFocusedKey` / `openFocus` helpers through a debounced timer ref.
- Clear the timer on unmount and when Focus Mode closes to avoid re-opening after Escape.
- Track a `lastInputWasKeyboard` ref, set on arrow-key navigation and cleared on real `mousemove`, to suppress hover takeover.
