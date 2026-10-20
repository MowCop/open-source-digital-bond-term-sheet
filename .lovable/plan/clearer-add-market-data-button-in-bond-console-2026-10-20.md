# Clearer "Add Market Data" button in Bond Console

## What changes
- In Vendor & Market Data Connectors, the Market Data group gets a visible labelled button: **+ Add Market Data** (instead of only the small + icon).
- Every other group gets the same style of labelled button, e.g. "+ Add Syndicate Tools" and "+ Add News & Wires", so they all look and work the same way.
- Clicking it opens the existing entry form already set to that section: name, description and an optional web link.
- Saved entries show up in that section straight away, can be edited, and can be deleted after you type "delete", as they can now.
- Nothing about live data changes. A new entry is either a link that opens in a new tab or shows "Not connected".

## Technical details
- `src/pages/BondConsolePage.tsx`: swap the icon-only category button for `Button size="sm" variant="outline"` with Plus + `Add {category}`. It keeps the same `setEditingEntry({ id: custom-uuid, category, ... })` handler.
- No changes to `src/lib/vendors.ts` storage or tests, because the behaviour stays the same.
