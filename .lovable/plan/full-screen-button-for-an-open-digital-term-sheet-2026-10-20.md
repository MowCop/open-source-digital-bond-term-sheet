# Full-screen button for an open Digital Term Sheet

## What you'll see
- A small square expand icon, bold and white, in the top-left corner of the open term sheet panel, just left of the ▾ arrow on the deal's title row. It only appears on the deal that is open.
- Clicking it fills the whole browser window with that term sheet: the deal title row, drop zone, Deal Checker, the Fill/View/XML/DLT/Documents tabs and Save. The sidebar and the page around the panel are hidden.
- In full screen the icon changes to a "shrink" icon in the same spot. Clicking it, or pressing Esc, puts the panel back exactly where it was, with your scroll position kept.
- Unsaved edits are kept when you switch between the two views, and nothing is saved automatically.
- The top-bar Co-Pilot stays visible above the full-screen panel, so you can still ask questions about the deal.
- Closing the deal (the ▾ arrow) also leaves full screen.

## Technical details
- In `src/pages/DealsPage.tsx`, add `fullscreenDealId` state. On the expanded deal's `Card`, add the toggle button (lucide `Maximize2` / `Minimize2`, `strokeWidth={3}`, `text-foreground`, `h-7 w-7` square, aria-label "Expand term sheet to full screen" / "Exit full screen").
- When full screen is on, the Card gets `fixed inset-x-0 top-12 bottom-0 z-30 overflow-auto rounded-none` (below the header so the Co-Pilot remains visible). The same Card instance stays mounted, so the unsaved Fill state is untouched.
- An Esc key listener runs while full screen is on. Collapsing the deal or changing the open deal clears `fullscreenDealId`. Page scroll is restored on exit.
- This is a presentation-only change; no data or term sheet logic changes.
