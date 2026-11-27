# DTS and Documents open in the same screen

- Remove the "Open full DTS" link, since it repeats the DTS link.
- Clicking **DTS** shows Deal term sheets in the same screen, the way Message works, without opening the Full DTS panel.
- Clicking **Documents** shows the deal's files in the same screen, also without opening the Full DTS panel.
- **Message** is unchanged.
- The Full DTS panel stays available from **More → Full DTS & exports**, and Deal Checker shortcuts that jump to a field still open it.

## Technical details
- src/components/DealPhaseWorkspace.tsx:
  - Link clicks call `onEditorOpen('sheets' | 'docs')` to switch the DealsPage tab only, without `setFull(true)`. The existing inline rule (`mobile==='dts'` shows the content) already shows it in the same screen.
  - Remove the "Open full DTS" button from the execution-phase aside, and drop the now-empty aside if nothing else uses it.
- src/pages/DealsPage.tsx: no change; `onEditorOpen={t => setTab(t ?? 'sheets')}` already selects the tab.
- Check in the running app on the Sasol deal: DTS and Documents each show their content inline with no Full DTS panel, Message still works, and More → Full DTS & exports still opens the panel.
