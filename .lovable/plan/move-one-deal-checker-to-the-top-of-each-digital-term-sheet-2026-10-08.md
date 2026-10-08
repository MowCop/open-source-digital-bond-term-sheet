# Move one Deal Checker to the top of each Digital Term Sheet deal

## Result
- Place one combined **Deal Checker** directly below the Generate New Issue Bulletin / stage-transition actions and directly above the **Fill / View / BDT XML / DLT view** bar.
- Keep it visible while any of those four tabs is open, so the assessment always belongs clearly to the expanded deal.
- Open in a compact summary state showing pass, warning and fail totals. The user can expand it to inspect the individual checks and their details.
- Remove the duplicate **Checks** list from the bottom of Fill and remove the older separate Deal Checker from its current lower position.

## Behaviour
- Use the Digital Term Sheet’s canonical combined check list: the vendored BDT `checks(state)` output followed by the VDR calendar, settlement and benchmark checks supplied by `unifiedChecks`.
- Keep the checker current as fields are edited in Fill, including before Save, and retain the latest assessment when switching to View, BDT XML or DLT view.
- Preserve refresh, severity filtering, all-clear/running states, detailed explanations and existing administrator override/audit behaviour where applicable.
- Reset the displayed assessment correctly when a different deal is opened.

## Technical details
- Add a focused presentation component for the unified Deal Checker, using the existing design and controls but accepting the canonical `CheckItem[]` output rather than running the legacy `validateDeal` list independently.
- Let `TermSheetFill` report its current authoritative BDT working state to `DealDetail`; initialize that shared state from `dealToBdtState(deal)` so the checker also works before Fill has mounted.
- Render the unified checker in `DealsPage.tsx` between the action row and `Tabs`; remove both existing duplicate render locations.
- Extend bridge-side check metadata only as needed for filtering and audited overrides. Do not modify any file in `src/lib/termsheet/`.

## Verification
- Check an expanded deal in all four tabs and confirm the same summary remains above the tab bar.
- Edit a Fill field and confirm the summary/results update without saving; save and reopen the deal to confirm consistency.
- Confirm only one check output exists on the page, with compact-by-default expansion and working filters/refresh.
- Run the relevant tests plus `node verify.mjs` and `node verify-dlt.mjs`, and confirm the preview build is clean.
