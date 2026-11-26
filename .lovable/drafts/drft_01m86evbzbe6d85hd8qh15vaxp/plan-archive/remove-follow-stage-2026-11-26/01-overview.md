# Remove "Follow stage"

Delete the "Follow stage" button from the deal header row (beside Set-up > Execution > Closed). Nothing else on the screen changes.

## Technical details
- src/components/DealPhaseWorkspace.tsx line 44: remove the Follow stage button. The phase still follows the deal's stage by default.
