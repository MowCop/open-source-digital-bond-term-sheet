# Let term sheet history record IPT and Allocated

## Problem
The deal's own stages (Mandate, Announced, Books Open, Launched, Books Closed, Priced, Settled) have no equivalent of the term sheet steps "Initial price thoughts" (2) and "Allocated" (6). Saving only records the step that matches the deal stage, so those two history buttons can never fill in.

## Change
- In the Fill tab, an editor can click the step just after the current one, as long as it sits between two deal stages (for example IPT while the deal is Announced, or Allocated while it is Priced). That marks it as the step being saved, shown by an outline and a "Saving as: Initial price thoughts" note.
- Save records the history entry under that step. The deal's own stage does not change.
- Moving the deal to a new stage resets the step to match it, as today.
- Past steps that have a saved entry open read-only, as now.

## Technical details
- TermSheetFill.tsx: add `saveStage` state, defaulting to `bdtStageForDeal(deal.stage)`. Allow `liveStage + 1` when no deal stage maps to that number. `save()` uses `next.stage = saveStage` before refreshAuto and the snapshot insert.
- No changes to src/lib/termsheet/ or the database.
