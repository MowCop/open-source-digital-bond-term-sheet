# Bring the Claude "VDR Digital Term Sheet" (Draft 3) into the app

## Goal
Make Claude's Draft 3 Digital Term Sheet usable inside Virtual Deal Room now, following Claude's "quickest route": embed the file as-is. The existing Digital Term Sheet list stays untouched.

## What you will see
- A new **Term Sheet Builder** entry in the side menu, directly under Digital Term Sheet.
- It opens the Draft 3 screen inside the app: the Fill tab with collapsed sections, "Show N optional fields" links, the document drop zone, and the Accept/Ignore review panel.
- A **Download** button that saves real files (XML/JSON) to your computer instead of copying them to the clipboard.
- A light/dark look that matches the rest of the app.

## Steps
1. Copy the uploaded HTML into the app's public files as `termsheet.html`, unchanged apart from the fixes below.
2. Fix the three things Claude said behave differently outside Claude:
   - Downloads: replace the Claude-only download call with a normal browser file download.
   - Drafts: keep saving in the browser for now (as it does today); saving drafts to each deal record is in "Later" below.
   - PDF/Word readers: keep loading them from the public CDN (works as-is).
3. Add a `/term-sheet-builder` page that shows the file full-height inside the normal app frame (menu and header stay visible, and it works on iPhone too).
4. Add the menu item to the desktop sidebar and the mobile drawer.

## Later (not in this plan; to do once you've tried it)
- Rebuild it properly as app screens and connect it to each deal, so drafts save against the deal record and the AI extraction replaces the pattern matching, with the same review panel as the check.
- Keep the ICMA BDT ordering tied to the schema file so moving to BDT 2.1 means regenerating it, not fixing it by hand.
- Add a lifecycle stage marker (IPT / guidance / launch / priced) and a stable deal key on every export, as Claude recommended for multi-vendor feeds.

## Technical details
- File: `public/termsheet.html` (from `vdr-digital-term-sheet_1.html`). Patch line ~577 `window.claude?.use?.("downloads")` → the `download()` path uses `Blob` + `URL.createObjectURL` + a temporary anchor.
- New page `src/pages/TermSheetBuilderPage.tsx`: `<iframe src="/termsheet.html" className="w-full h-[calc(100vh-7rem)] border rounded-md" />`, route added in `App.tsx` inside `RequireAuth` + `AppLayout`.
- `navItems` in `AppLayout.tsx`: add `{ path: '/term-sheet-builder', label: 'Term Sheet Builder', icon: FileSpreadsheet }`.
