# Move Deal Co-Pilot to the top bar

Location change only — no changes to what Co-Pilot does.

## What you will see
- Top bar: magnifying glass, then **Deal Co-Pilot** label with its "i", then the "Ask about this deal…" box to its right.
- Clicking the label (or sending a question) drops down the full Co-Pilot panel (chat, corrections, reviews) under the top bar, over the page. Clicking the label again or the X closes it.
- Co-Pilot works on the deal currently open in the Digital Term Sheet. With no deal open, the label and box are greyed out with the hint "Open a deal to use Co-Pilot".
- Inside the Digital Term Sheet, the Co-Pilot block disappears. The **Deal Checker** stays where it is (above the Term Sheet tabs) as its own panel, unchanged.
- The pass/warning/fail counts move with Co-Pilot into the top bar label.

## Technical details
- `AppLayout.tsx`: add an empty mount slot (`#copilot-slot`) right after `<GlobalSearch />`, with a disabled placeholder shown when nothing is portalled in.
- `DealsPage.tsx`: render `UnifiedDealChecker` directly (no longer as the `checker` prop) and render `DealCopilot` through `createPortal` into the slot, only for the expanded deal — keeps all deal context, Fill handlers, unsaved-terms state and live-checks wiring intact.
- `DealCopilot.tsx`: header becomes a compact top-bar row; body becomes an absolutely positioned dropdown (max height, scrollable). `checker` prop removed. No logic, prompts, backend or approval changes.
- Quick check in the preview: open Al Rajhi, ask a question from the top bar, confirm the Deal Checker still shows in DTS.
