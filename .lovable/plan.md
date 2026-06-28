## Show greyed-out Megaphone when bulletin already generated

Currently, when a deal already has a published bulletin (e.g. Kingdom of Nania), the UI swaps the gold "Generate New Issue Bulletin" button for a different `FileText` icon, so it's not visually recognisable as the same action.

Update the "bulletin already exists" state in `src/pages/DealsPage.tsx` to reuse the **same Megaphone icon** as the active button, but rendered in a greyed-out / disabled-looking style. Clicking it still navigates to the New Issue Board for that deal.

### Changes (two places in `src/pages/DealsPage.tsx`)

1. **Deals list row (around lines 388–399)** — the per-row icon button:
   - Replace `<FileText />` with `<Megaphone />`.
   - Keep `variant="outline"` and the same `h-9 w-9` size as the active version (so the slot looks identical).
   - Drop `btn-champagne`; instead use muted styling: `opacity-50`, muted border, no gold gradient.
   - Icon colour: `text-muted-foreground` (greyed) instead of gold `#f3d98a`.
   - Tooltip stays: "Bulletin published — view on New Issue Board".
   - `onClick` still navigates to `/messages?dealId={deal.id}`.

2. **Expanded Deal Detail header (around lines 71–74)** — the inline "Bulletin published" button:
   - Replace `<FileText />` with `<Megaphone />`.
   - Match the active button's `size="default"` and shape, but greyed: `variant="outline"`, no `btn-champagne`, `opacity-50`, muted icon + label colour.
   - Label remains "Bulletin published" (clarifies the state); navigates to the New Issue Board on click.

No other files, no logic changes — `bulletinByDeal` detection and the `hasBulletin` prop stay as-is.