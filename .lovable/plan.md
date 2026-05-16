# Esc collapses expanded alert panel

In the Issue Board, pressing **Esc** while an alert history card is expanded should collapse it back to its header-only state (matching the attached screenshot of the expanded "Update #4" panel).

## Change (src/components/AlertHistoryCard.tsx)

- Add a `useEffect` that, when the card is expanded (`isOpen === true`), attaches a `keydown` listener on `window` for `key === 'Escape'` and calls `setIsOpen(false)`. Clean up on unmount / when collapsed.
- Guard: do nothing if the edit modal is open (`mode === 'edit'`) — Radix Dialog already owns Esc in that case and we don't want a double-close.
- Latest-version cards force-expand via `isLatest` and are not user-collapsible today; leave that behavior unchanged. Esc only collapses cards the user opened themselves.

## Verification

- Open a non-latest alert card → press Esc → card collapses to header row.
- Open the Edit alert modal → press Esc → only the modal closes (existing confirm-on-dirty still runs); the underlying card stays as it was.
- Latest card stays expanded on Esc (unchanged).
