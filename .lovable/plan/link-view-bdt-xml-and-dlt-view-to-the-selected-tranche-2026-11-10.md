# Link View, BDT XML and DLT view to the selected tranche

## What you will see
- **Single click** a tranche row on Deal term sheets to select it (highlighted). Double-click and the arrow still open its term sheet.
- Tranche A is selected when a deal opens.
- View, BDT XML and DLT view each show a strip at the top: "Tranche B · USD 500m · 10yr · Floating" plus A–E buttons to switch tranche. Switching there also changes the highlighted row.
- Each tab shows that tranche's own terms (maturity, coupon/spread, amount, etc.) together with the deal-wide terms (issuer, bookrunners, governing law). Copied fields show Tranche A's value unless the tranche changed them.
- BDT XML exports the selected tranche only.
- Single-tranche deals look as today (strip shows "Tranche A" only).

## Technical details
- Lift `selectedTrancheId` into `DealDetail` (DealsPage.tsx); pass to `DealTermSheets` (row onClick selects, highlight style) and the three tabs.
- New `src/lib/trancheState.ts`: `trancheBdtState(main, workspace, trancheId)` builds a BdtState by overlaying the tranche's values via `scopeOf`/`trancheValue` from trancheFields.ts (Tranche A = main state unchanged). Pure, with tests: A returns main; B overrides own fields, inherits copied, never alters deal-wide.
- View uses `termSheetView(trancheBdtState(...))`; `BdtXmlPanel` and `TermSheetDlt` receive the derived state instead of reading only the deal's saved terms.
- DLT view editing for non-A tranches: read-only for now with a note "Edit in the tranche term sheet" (avoids two write paths); Tranche A stays editable.
- Shared `TrancheSwitcher` component for the strip.
- AGENTS.md rule: tabs derive per-tranche state via trancheState.ts, one overlay function.
