## Objective
On the New Issue Board (`src/pages/MessagesPage.tsx`), make the three controls in each expanded row consistent buttons in this left-to-right order: **Deal Chat**, **Deal Alert Data**, **Update History**. Rename "Open Chat" to "Deal Chat", and add a brief border flash animation when any of the three is clicked.

## Changes

**File: `src/pages/MessagesPage.tsx`**
- Replace the current `Tabs`/`TabsList` + right-aligned "Open Chat" button with a single left-aligned row of three identically-styled buttons (`size="sm" variant="outline" className="text-xs"`):
  1. **Deal Chat** — `MessageSquare` icon, opens the side chat panel (existing `handleOpenChat`).
  2. **Deal Alert Data** — `Database` icon, toggles the linked-deals panel (currently `TabsContent value="data"`).
  3. **Update History (n)** — `History` icon (new lucide import), toggles the alert history list (currently `TabsContent value="history"`).
- Replace `Tabs` state with a local `activePanel` per expanded group: `'history' | 'data' | null`. Default to `'history'` when a row is first expanded so existing behaviour (history visible) is preserved.
- A second click on the active button collapses that panel (sets `activePanel` to `null`); Deal Chat is independent (opens side panel as today, no collapse needed).
- Remove now-unused `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` imports.
- Add `History` to the lucide-react import.

**Brief border flash on click**
- Add a tiny CSS keyframe utility in `src/index.css`:
  ```css
  @keyframes border-flash {
    0%   { box-shadow: 0 0 0 2px hsl(var(--primary) / 0.0); }
    30%  { box-shadow: 0 0 0 2px hsl(var(--primary) / 0.9); }
    100% { box-shadow: 0 0 0 2px hsl(var(--primary) / 0.0); }
  }
  .animate-border-flash { animation: border-flash 450ms ease-out; }
  ```
- In `MessagesPage.tsx`, track `flashingBtn: string | null` (key: `${groupKey}:${btn}`). On click, set it, then clear via `setTimeout(..., 500)`. Apply `animate-border-flash` className to the clicked button when its key matches.

## Acceptance Criteria
- [ ] Each expanded New Issue row shows three buttons in order: **Deal Chat**, **Deal Alert Data**, **Update History (n)** — all the same `outline` `sm` style, left-aligned on one row.
- [ ] "Deal Chat" opens the side chat panel exactly as "Open Chat" did before.
- [ ] "Deal Alert Data" reveals the linked-deals panel; clicking it again hides it.
- [ ] "Update History" reveals the alert history list; clicking it again hides it. History is shown by default when a row is first expanded.
- [ ] Clicking any of the three buttons triggers a brief (~450ms) primary-coloured border flash on that button.
- [ ] No leftover `Tabs` imports or markup; row layout is otherwise unchanged.
