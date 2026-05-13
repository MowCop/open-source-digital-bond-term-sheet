## Objective
When a user navigates to Deal Data via "Open Deal Data" (or `/deals?dealId=...`), land them directly on that deal's full data form. Replace the current 3-column card grid + ring-highlight pattern with a clean headline list (matching the New Issue Board style) where the active deal is expanded inline and others appear as collapsed clickable headlines.

## Current Behaviour (problem)
- `/deals` shows: Pipeline counts, then a 3-column grid of summary cards, then — only if a deal is selected — a separate detail panel below. Navigating with `?dealId=X` highlights the matching grid card with a ring and scrolls/reveals the detail card. The user has to mentally connect highlight + detail, and other deals stay shown as full mini-cards.

## New Behaviour
- Pipeline counts strip stays at top (useful overview, low-clutter).
- Deal grid is removed.
- Below the pipeline strip, render **one row per deal** as a compact clickable headline (similar to AlertHistoryCard collapsed state on the New Issue Board):
  - chevron · issuer name · `CCY size · tenor` · stage badge · "Updated MMM d, HH:mm"
- Exactly one deal is expanded at a time. Clicking a headline expands it and collapses any other; clicking the expanded headline collapses it.
- The expanded section renders the existing **full Deal Data form** (Party/Issuer · Issuance · Product · Bookrunners · Stage History · Advance-stage control), unchanged in content.
- When arriving via `?dealId=X`, auto-expand that deal and scroll its row into view. No grid highlight needed.
- "New Deal" button stays in the header.

## Implementation Notes (file: `src/pages/DealsPage.tsx`)
- Replace the `selectedDeal` state with `expandedDealId: string | null`.
- Sort deals newest-updated first (matches New Issue Board ordering).
- Remove the 3-column card grid block (lines ~176–196) and the separate detail panel (lines ~198–305). Replace with a single list:
  ```
  deals.map(deal => (
    <Card>
      <button onClick={toggle}>headline row</button>
      {expanded && <DealDetailBody deal={deal} />}
    </Card>
  ))
  ```
- Extract the existing detail body (3-column grid + Stage History + Advance-stage header control) into an inline `<DealDetail>` block reused inside the expanded row — same fields, same `fieldRow`, same Advance button.
- `useEffect` on `searchParams.dealId` sets `expandedDealId` and calls `el.scrollIntoView({ block: 'start' })` via a `ref` map.
- Remove unused imports (e.g. `ChevronRight` if no longer used elsewhere — actually still used in Advance button — keep). Add `ChevronDown`.

## Acceptance Criteria
- [ ] Visiting `/deals` shows pipeline strip + headline list only.
- [ ] Visiting `/deals?dealId=X` lands with deal X already expanded and visible (scrolled into view), no extra clicks.
- [ ] Clicking another deal's headline collapses the previous one and expands the clicked one.
- [ ] Clicking an expanded headline collapses it.
- [ ] All existing fields, bookrunners, stage history, and "Advance to next stage" remain functional inside the expanded view.
- [ ] "New Deal" creation flow unchanged.