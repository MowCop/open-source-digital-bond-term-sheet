# Fix: Esc must also collapse the latest alert card

## Root cause

In `src/components/AlertHistoryCard.tsx`:

```ts
const expanded = isOpen || isLatest;
```

For the **latest** update card (white-bordered "Update #4" in the screenshot), `isLatest` is `true` and `isOpen` stays `false`. The Esc effect I added only runs `if (isOpen)`, so the listener never attaches and Esc is a no-op on the panel the user actually wants to collapse.

## Fix

Add a user-controlled collapse override that can defeat `isLatest`:

1. New state `collapsedOverride` (default `false`).
2. Redefine `expanded = collapsedOverride ? false : (isOpen || isLatest)`.
3. The header click toggles correctly for both cases:
   - if currently expanded → set `collapsedOverride = true`, `isOpen = false`
   - if currently collapsed → set `collapsedOverride = false`, `isOpen = true`
4. Esc effect listens whenever `expanded === true` (not just `isOpen`) and on Esc sets `collapsedOverride = true` + `isOpen = false`. Still skip when `mode === 'edit'`.
5. When a new latest version arrives (different `message.id`), reset `collapsedOverride` to `false` so the new latest expands by default.

## Verification

- Latest card expanded → press Esc → collapses to header row.
- Click the collapsed header → expands again.
- Non-latest card: click to expand → Esc collapses (unchanged).
- Open Edit alert modal with Esc → only the modal closes; underlying card state unchanged.
- After a "Save & Send" creates a new latest version, that new version is expanded by default.
