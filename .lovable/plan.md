## Goal

Make the floating Deal Chat panel movable across the screen so it never permanently covers a row the user wants to read. Modal "Expand" mode is unchanged.

## Options considered

### A. Dedicated drag handle in the header (recommended)

A clearly draggable strip at the top of the panel ("≡ Deal Chat — Lithuania" with `cursor: grab`/`grabbing`). Press & hold anywhere on the header, drag to reposition. Buttons inside the header (Expand, Close) still work normally because they stop propagation.

**Pros**
- Predictable: matches every desktop floating-window pattern users already know (Slack huddles, Figma comments, Mac windows).
- Zero conflict with chat interactions — clicking a message, scrolling, selecting text, typing, and pressing Send never accidentally drags the panel.
- Touch-friendly on the < 900 px bottom-sheet fallback (the handle becomes a grab bar at the top).

**Cons**
- Smaller drag surface than "anywhere in the panel".

### B. Press-and-hold anywhere in the panel

Long-press (≈250 ms) anywhere that isn't a button/input/scroll area, then drag.

**Pros**: huge drag surface.
**Cons**: confusing during normal use — every accidental hold becomes a drag; conflicts with text selection in messages, with the message list's scroll inertia, and with the channel selector. Also slower to grab because of the hold delay.

### C. Modifier-click drag (Alt/Option + drag)

Hold Alt and drag anywhere.

**Pros**: doesn't conflict with anything.
**Cons**: undiscoverable; non-mac users don't expect it.

### Recommendation

**Option A + a small enhancement from B**: a real drag handle, plus the *entire header bar* (logo row + sub-info row) is grabbable, giving a generous ~64 px tall drag strip without touching the chat body. This is the standard floating-window pattern and avoids every interaction conflict.

## How it will work

1. The panel's header (logo + title + Secure Channel badge + Expand + Close, plus the deal sub-row) becomes the drag region. `cursor: grab`, `cursor: grabbing` while dragging, `select-none` to prevent text-selection during drag.
2. `pointerdown` on the header (ignored if the original target is a `button`, `a`, `input`, `select`, `[role="dialog"]`) captures the pointer, records the starting `{ panelX, panelY, pointerX, pointerY }`, and switches the panel's positioning from `bottom-right anchored` to absolute `{ top, left }` in viewport coordinates.
3. `pointermove` updates `{ top, left }`, clamped to keep at least 80 px of the panel on-screen on every side so the user can't lose it.
4. `pointerup` / `pointercancel` releases capture.
5. The panel position persists for the session via a ref on `MessagesPage` (not localStorage — fresh session resets to bottom-right, matching typical floating-window behaviour). Re-opening the panel for any deal restores the last drag position.
6. **Double-clicking the header** snaps the panel back to its default bottom-right anchor (escape hatch if the user moves it off-screen or wants the default back).
7. On the < 900 px bottom-sheet fallback, dragging is disabled — the sheet is full-width and dragging makes no sense; the handle is still shown but acts only as a visual grip.
8. Pointer Events (not mouse events) so trackpad, mouse, pen, and touch all work without separate code paths.

## Visual cues

- Tiny `GripHorizontal` icon (lucide) on the left of the header to advertise draggability.
- `cursor: grab` on the header by default → `grabbing` mid-drag.
- A subtle shadow bump during drag (`shadow-2xl` → `shadow-[0_30px_80px_-10px_rgba(0,0,0,0.6)]`) so the panel feels lifted.
- Tooltip on the grip: "Drag to move · double-click to reset".

## Files that will change

- `src/components/FloatingChatPanel.tsx` — add `useDragPosition` logic (Pointer Events, clamp to viewport, double-click reset, ignore interactive targets), render the grip icon, switch position from `bottom-4 right-4` to controlled `{ top, left }` once moved. Disable drag at viewport < 900 px.
- *(Optional)* `src/pages/MessagesPage.tsx` — pass/persist a `panelPositionRef` so reopening the panel for another deal keeps the user's chosen position. Not strictly required if state lives inside `FloatingChatPanel` and the component is kept mounted while open.

## Out of scope

- No change to the Modal Dialog (Expand) behaviour — user confirmed it's fine.
- No change to chat content, channels, persistence, or the row-level chat box.
- No resize handle (separate request if needed later).

## Recommendation

Ship **Option A**: header drag with `GripHorizontal` icon, Pointer Events, viewport-clamped position, double-click header to reset, drag disabled on the mobile bottom-sheet fallback.