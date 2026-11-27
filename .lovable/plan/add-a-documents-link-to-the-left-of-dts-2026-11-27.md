# Add a Documents link to the left of DTS

The deal's top link row changes from "DTS · Message" to:

Documents · DTS · Message

- Clicking **Documents** opens the **Documents** tab, showing the deal's files.
- Clicking **DTS** works as it does now and opens Deal term sheets.
- **Message** is unchanged.
- Inside the DTS panel the Documents tab is no longer visible.

## Technical details
- src/lib/dealPhase.ts: `WorkspaceTab` becomes `'docs' | 'dts' | 'message'`; `WORKSPACE_TABS = ['docs','dts','message']`. Update src/test/workspaceTab.test.ts.
- src/components/DealPhaseWorkspace.tsx: label `docs` as "Documents". Clicking it sets the visible pane to `dts` (same visibility as DTS) and calls `openEditor('docs')`. `onEditorOpen` takes an optional tab id.
- src/pages/DealsPage.tsx: `onEditorOpen={t => setTab(t ?? 'sheets')}`. Remove the `docs` TabsTrigger from the DTS tab row; the Documents content still shows when opened from the Documents link.
- Check in the running app: Documents opens the Full DTS on Documents, DTS opens it on Deal term sheets, and Message still works.
