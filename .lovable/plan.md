

## Why the Eurofima Alert Disappears

All app data (deals, messages, users, audit log) lives in **React `useState` inside `AppProvider`** (`src/context/AppContext.tsx`). That state exists only in memory for the lifetime of the component.

Looking at `src/App.tsx`, the structure is:
```
AppProvider → BrowserRouter → AppLayout → Routes
```

So `AppProvider` sits *above* the router and should persist across route changes. **It does** — but only if React doesn't unmount it. The most likely cause of data loss here is one of:

1. **Hot Module Replacement (HMR)** during dev re-initialises `mockUsers`/`mockDeals`/`mockMessages` from `mockData.ts`, wiping the in-memory additions. This happens silently when any file is edited or saved.
2. **A full page reload** (refresh, back/forward across an external nav) resets all state because nothing is persisted.
3. Even without HMR, navigating to certain routes that throw or remount the tree would clear state.

In short: **there is no persistence layer**. Everything resets to `mockData.ts` on any reload/HMR. New deals and alerts you create only live in memory.

## Fix: Persist app state to `localStorage`

Add a lightweight persistence layer inside `AppContext.tsx` so user-created data survives reloads, HMR, and navigation.

### Changes (single file: `src/context/AppContext.tsx`)

1. Add a small helper `usePersistedState<T>(key, initial)` that:
   - Reads `localStorage` on init, falling back to `initial` (the mock data) if empty or parse fails.
   - Revives `Date` fields (createdAt, updatedAt, sentAt, timestamp, etc.) since JSON loses Date types.
   - Writes back to `localStorage` whenever state changes (debounced via `useEffect`).

2. Replace each `useState(mockX)` with `usePersistedState('bondvdr.x', mockX)` for: `users`, `deals`, `messages`, `auditLog`, `notifications`, `distributionLists`, `chatChannels`, `chatMessages`, `currentUser`.

3. Add a **"Reset demo data"** button (small, in `AppLayout` footer or sidebar) that clears all `bondvdr.*` keys and reloads — useful for the prototype so you can return to the seeded mock state.

### Result

- Creating the Eurofima alert writes the new deal + message to `localStorage`.
- Navigating away from `/messages` and back: state is still in memory (no change needed).
- Refresh / HMR / closing tab and reopening: state is rehydrated from `localStorage`, so Eurofima still appears.
- Reset button restores original mock data when needed.

### Notes

- Pure client-side, no backend required — fits the prototype scope.
- Date revival is done by walking known field names per entity type to avoid a generic reviver hurting performance.
- If a future step moves to Lovable Cloud / Supabase, this layer is easy to swap out for real persistence.

