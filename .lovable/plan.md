## Goal
Make the **New Issue Chat** panel on `Create New Issue` vertically resizable by click-and-hold on its header bar, so users can grow or shrink the chat while the New Issue Bulletin (and AI Extraction / Deal Checker side panels) shrink/grow correspondingly — total page height stays constant.

## Files to change
- `src/components/DraftChatStrip.tsx` — add drag-resize logic + height state, persisted to localStorage per user.
- `src/pages/AIDraftPage.tsx` — pass a `bulletinHeightOffset` (or simply let the bulletin column flex) so the bulletin editor's content area shrinks when the chat grows.

## Behavior
1. **Drag handle = the whole "New Issue Chat" header bar** (the row with title / participant badge / collapse chevron). Cursor switches to `ns-resize` on hover; mousedown starts a drag, mousemove updates height, mouseup ends.
2. Chat panel height is clamped between a sensible min (≈180 px, current default) and max (≈70% of viewport height).
3. **Squeeze behavior**: the bulletin editor below uses `flex-1 min-h-0` inside a fixed-height column container, so as the chat grows the bulletin's editable area shrinks automatically. AI Extraction and Deal Checker side panels keep their alignment because they live in the same column grid.
4. **Persistence**: store the chosen height in `localStorage` under `bondvdr.aiDraft.chatHeight` (per browser/user, matching the existing `bondvdr.aiDraft.chatOpen` pattern).
5. Existing collapse chevron still works (independent of height); when collapsed, height value is preserved for next expand.
6. Click-without-drag on the header (movement < 4 px) does nothing — does not toggle collapse (collapse stays on its dedicated chevron) to avoid accidental toggles while grabbing.

## Technical notes
- Add `const [height, setHeight] = useState(() => Number(localStorage.getItem('bondvdr.aiDraft.chatHeight')) || 280)`.
- On the messages ScrollArea, replace `max-h-48` with an inline `style={{ height }}` (minus header/input/participants heights) so the panel resizes smoothly.
- Drag handler: `onMouseDown` on the header attaches `mousemove` + `mouseup` to `window`, computes `newHeight = startHeight + (e.clientY - startY)`, clamps, calls `setHeight`. Persist on mouseup.
- Add `cursor-ns-resize select-none` to the header div; keep buttons inside it with `cursor-pointer` and `stopPropagation` on their `onMouseDown` so clicking the chevron / participant toggle doesn't start a drag.
- No backend or schema changes.

## Out of scope
- Horizontal resize, drag-to-reorder, mobile-touch resize gestures (will work via pointer events but not specifically tuned), animations.
