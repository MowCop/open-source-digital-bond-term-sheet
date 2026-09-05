# Fix: dragging a file onto the attachments area does nothing

## What's wrong

The "Drop PDF, DOCX, or PPTX here" strip only appears when the mouse *hovers* over the attachments panel. Dragging a file does not count as hovering, so during a drag the strip is not on screen at all — and because the drag handlers live on that strip, nothing detects the file, nothing highlights, and the drop is ignored. The browser then just opens the dragged file in a new tab.

Both attachment areas in the edit screen (the sent-message panel and the draft editor panel) have the same problem.

## The fix

1. Move drag detection up to the whole attachments panel, so a file dragged anywhere over that panel is recognised immediately.
2. As soon as a file drag enters the panel, reveal the drop strip and highlight it with the bright border, exactly as the mouse-hover state does today.
3. Use an enter/leave counter so moving across the file rows inside the panel does not make the highlight flicker off.
4. Explicitly mark the drag as a "copy" so the cursor shows the correct drop indicator.
5. On drop, accept the files through the existing upload path (PDF/DOC/DOCX/PPT/PPTX), ignore anything that is not a file drag, and clear the highlight.
6. Keep the current behaviour intact: click the strip to open the file picker, the upload icon still works, and everything stays on one row.

## Technical notes

- File: `src/components/AlertHistoryCard.tsx`, both attachment blocks (around lines 380-420 and 745-780).
- Add `dragDepth` ref/state per panel; put `onDragEnter` / `onDragOver` / `onDragLeave` / `onDrop` on the panel container instead of only the inner strip.
- Guard with `e.dataTransfer.types.includes('Files')`; set `e.dataTransfer.dropEffect = 'copy'` in `onDragOver`.
- Render condition becomes `attachmentsHover || dragOver`, unchanged, but `dragOver` is now driven by the container handlers so it turns true during a real drag.
- Reuse existing `handleFiles`.
