# Fix: Fill / View / BDT XML / DLT view tabs not switching

## Cause
The Fill tab is kept mounted at all times (so the document drop panel can pass files to it), but it is never hidden when another tab is selected. Its content stays on screen above View / BDT XML / DLT view, so clicking those tabs appears to do nothing.

## Fix
- In `src/pages/DealsPage.tsx`, keep `forceMount` on the Fill `TabsContent` but add `data-[state=inactive]:hidden` so it hides when another tab is active (state, drafts and the ingest handle are preserved).
- No other changes.

## Verify
Open a deal in the preview, click each of Fill, View, BDT XML, DLT view and confirm only that tab's content shows; drop a file while on View and confirm it jumps back to Fill with proposals.
