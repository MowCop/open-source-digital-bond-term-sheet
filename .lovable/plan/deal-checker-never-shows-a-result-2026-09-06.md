# Deal Checker never shows a result

## What you're seeing

In the screenshot the panel is stuck on "Analysing 23 extracted fields…". That message is not a progress state — it is what the panel shows whenever the checks come back with nothing to report. So the checker did run, found no issues to flag, and then had nothing to display, leaving the misleading "Analysing…" line on screen forever.

Two things are wrong:
1. There is no way to tell "still running" from "finished, nothing found".
2. A clean deal gets no confirmation — no green "all checks passed", no list of what was actually checked.

## The fix

1. Track a real running state: show "Analysing…" with a spinner only while the check is actually in flight (during the short delay before it runs, and while Refresh is spinning).
2. When the check finishes with no findings, show a green all-clear card: "All checks passed" plus the number of fields checked and the time it last ran.
3. Show what was checked even when everything passes — list the rule groups that ran (dates and business days, pricing consistency, identifiers, ratings, bookrunners, stage completeness) each with a green tick, so the user can see the checker did real work.
4. Keep the existing findings list, severity filters, override flow and audit entries exactly as they are when there are findings.

## Technical notes

- `src/components/DealChecker.tsx`: add a `status` state (`idle | running | done`) set around the debounced `validateDeal` call in the existing effect; replace the `results.length === 0` branch with a done/all-clear card versus a running indicator; add a `lastRunAt` timestamp.
- Passed-check list: derive from a static list of rule-group labels in the component, marked green when no result in that group is present. No changes to `src/lib/bondValidator.ts` rule logic.
- Empty-deal case (`fieldCount === 0`) keeps its current prompt.
