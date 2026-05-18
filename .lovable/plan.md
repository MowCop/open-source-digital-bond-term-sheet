## Problem

On Create New Issue, the compose card splits into two equal rows (`grid-rows-2 min-h-[400px]`): the body editor on top and a dedicated "Drag and drop…" zone on the bottom. On a 556×552 viewport that pushes the drop zone below the fold, so users scroll to reach it. The body editor also wastes space when empty.

## Recommended approach (combine two ideas)

1. **Make the entire compose pane one drop target.** Move `onDragOver` / `onDragLeave` / `onDrop` from the small bottom zone up to the outer card wrapper (the `bg-card border ... rounded-lg` div). Files can then be dropped on the headline, body, or attachment strip — anywhere in the pane.

2. **Replace the half-height drop zone with a slim attachment strip.** Drop the `grid-rows-2 min-h-[400px]` split. Let the body editor take the full height of the card, and render attachments as a compact strip pinned to the bottom of the card (above the action bar), only as tall as its contents:
   - Empty state: a single thin row "Drag files anywhere, or click Attach" with a paperclip icon.
   - With files: the existing chip list, wraps to one or two lines max.

3. **Full-pane drag overlay for feedback.** When `isDragOver === true`, overlay the card with a dashed accent border + tinted background + centered "Drop files to attach" label (absolute, pointer-events-none) so the user gets a clear target without changing layout.

4. **Keep the Attach button** in the bottom action bar as the click-to-browse fallback (unchanged).

## Why this is better than just moving the zone up

- The body editor stays the dominant area (what users actually type into) instead of being squeezed.
- Drop works from anywhere in the pane, so vertical position of the zone stops mattering.
- The viewport no longer needs scrolling to reach a drop target on small screens.
- Text entry after drop is naturally supported — the headline and body stay editable; dropping a file just populates them via the existing `applyExtractedText` flow.

## Files touched

- `src/pages/AIDraftPage.tsx` — move drag handlers to outer card, remove `grid-rows-2`, collapse the dedicated drop zone into a slim attachment strip, add absolute drag overlay.

## Verification

- 556×552 viewport: headline, body, attachment strip, and action bar all visible without scrolling.
- Drag a PDF onto the headline / body / attachment strip → overlay highlights, drop attaches and triggers extraction.
- Typing into headline and body after a drop still works.
- Click Attach still opens the file picker.
