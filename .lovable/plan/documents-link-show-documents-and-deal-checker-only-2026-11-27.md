# Documents link: show documents and Deal Checker only

## What changes
Clicking **Documents** works like **Message**:
- The Deal Checker bar shows at the top.
- The deal's document list shows below it, with titles visible straight away.
- The Deal Terms heading and its tabs (Deal term sheets, Standard text, XML, DLT, All fields) are hidden.

Clicking **DTS** still shows Deal Terms with its tabs, as it does now.

## Technical details
- `src/components/DealPhaseWorkspace.tsx`: add an optional `documents` prop (ReactNode). When `active==='docs'`, render the standalone `UnifiedDealChecker` (the one Message uses) followed by `documents`, and hide `children` (the Deal Terms block). Docs no longer sets `mobile` to `'dts'`, and it no longer calls `onEditorOpen('docs')`.
- `src/pages/DealsPage.tsx`: pass `<DealDocuments dealId canManage defaultOpen />` as `documents`, and remove the `docs` TabsContent from inside Deal Terms.
- In Set-up, Documents shows the documents list with the drop zone and hides the terms.
- To verify: run a signed-in browser check on Sasol. Click Documents and confirm the checker and document titles appear without Deal Terms. Click DTS and confirm Deal Terms comes back. Click Message and confirm it hasn't changed.
