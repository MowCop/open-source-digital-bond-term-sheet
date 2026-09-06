# Move Save/Save & Send/Retract to the left on edit deal toolbar

## Goal
On the edit deal screen, move the Save, Save & Send, and Retract controls from the far right of the toolbar so they sit directly beside the left-side functional icons (Edit, Chat, AI DataParse, Deal Checker, OrderBook, Docs).

## Current state
In `src/components/AlertHistoryCard.tsx` the toolbar row uses `ml-auto` on the Save/Save & Send/Retract group, pushing it to the right edge of the header.

## Proposed change
1. In `src/components/AlertHistoryCard.tsx`, remove the `ml-auto` wrapper around the Save / Save & Send / Retract buttons.
2. Render those three buttons immediately after the Docs icon in the same left-to-right toolbar row, preserving their existing tooltips, orange action borders, and red Retract icon.
3. Keep the buttons icon-only and square-shaped; do not reintroduce text labels.
4. Optionally retain a subtle visual separator or background on the Save group so it remains distinguishable as an action cluster, but keep it left-aligned.
5. Verify typechecking passes and confirm visually in the preview that the toolbar now reads left-to-right as: Edit, Chat, AI DataParse, Deal Checker, OrderBook, Docs, Save, Save & Send, Retract.

## Out of scope
- No changes to button functionality (Save, Save & Send, Retract behavior remains the same).
- No changes to the New Issue Board row toolbar unless the user confirms it should also be moved.
