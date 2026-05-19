## Goal

Improve the expanded latest-update panel on the Messages / Issue Board:

1. Remove the duplicate Delete button.
2. Make the "click anywhere to edit" affordance discoverable via a highlighted, hoverable border.
3. Make `Esc` always cascade fully back to the closed Issue Board row in one keystroke.

## Scope

Single page + single component. No data / business logic changes.

- `src/components/AlertHistoryCard.tsx`
- `src/pages/MessagesPage.tsx`

## Problem analysis

In the screenshot the expanded panel shows **Delete** twice:

- Top row inside the alert card (`AlertHistoryCard.tsx` action bar, line ~381) — deletes only this one update/alert message.
- Bottom action bar in `MessagesPage.tsx` (line ~683) — deletes the entire deal thread (all updates + chat + data). Styled red.

Both say just "Delete" with the same icon → users cannot tell them apart, and on the latest-update card the per-update Delete is largely redundant because Retract already exists for sent messages and the deal-level Delete already removes everything.

The "click body to open full editor" affordance is invisible — there is only a faint hover background.

`Esc` already cascades (line ~73 effect), but only when no inner alert card is expanded. For the latest update (embedded mode) there is no expand/collapse, so this works; we just need to make sure pressing Esc inside the full-screen editor closes the editor AND the deal row in one press from the user's perspective.

## Changes

### 1. Remove duplicate Delete from the latest update card

In `AlertHistoryCard.tsx` action buttons block (lines ~360–388):

- When `isLatest && embedded` → hide the per-message Delete button entirely. The deal-level Delete in the parent row covers it, and Retract remains for sent messages.
- Keep per-message Delete for historical (non-latest) updates in Update History, since those need individual removal.

### 2. Edit affordance — highlighted clickable border

In `AlertHistoryCard.tsx`, the embedded latest container (line ~194):

- Replace the subtle `hover:bg-card/40` with a persistent dashed/soft accent border that brightens on hover, plus a small "Click to edit" hint (icon + text, `text-xs text-muted-foreground`) in the top-right of the body region.
- Tokens only (`border-primary/40`, `hover:border-primary`, `hover:bg-primary/5`, `ring-1 ring-primary/20` on hover). No raw colors.
- Keep the existing click-to-open-editor handler; interactive children (`button, a, input`) still stop propagation.
- Add `title="Click anywhere to edit — Esc to close"` on the container for tooltip discoverability.

### 3. Esc cascade from full-screen editor → closed Issue Board row

In `MessagesPage.tsx` Esc effect (line ~73):

- Currently bails out if a `[role="dialog"][data-state="open"]` exists. Change to: when the editor dialog closes (detected by transitioning from open→closed), also clear `expandedAlertId` on the next tick so a single Esc press from inside the editor returns the user all the way to the collapsed Issue Board row.
- Implementation: track a ref `wasEditorOpenRef`; in a `useEffect` watching `document` for the dialog state (or simpler: in `AlertHistoryCard`'s `attemptClose`, after closing the editor, dispatch a `CustomEvent('alert-editor-closed')` that `MessagesPage` listens for and uses to `setExpandedAlertId(null)`).
- Net behavior:
  - Esc inside editor → closes editor AND collapses deal row (one press).
  - Esc on expanded row (no editor) → collapses row (already works).
  - Esc on closed row → no-op.

## Out of scope

- Restyling Retract / Send / chat buttons.
- Changing the deal-level Delete confirmation flow.
- Update History panel layout.
- Any backend or data model changes.
