# Compact Deal Checker beside Deal Terms

## What changes
1. **One row:** The Deal Checker moves up onto the same row as the term sheet heading, which is renamed from "TERM SHEET" to **"DEAL TERMS"**. The tabs stay on that row too.
   ```text
   [DEAL TERMS]  [Deal Checker  5 pass 15 warn 1 fail  ⟳  ⌄]   [Deal term sheets | View | ... | All fields]
   ```
2. **Collapsed by default:** Only a small chip shows: shield icon, "Deal Checker", the pass/warn/fail counts, a refresh icon (re-runs checks) and an expand chevron, styled like the one on tranche rows.
3. **Expands on click:** Clicking the chip or the chevron opens the panel underneath the row. It shows the full pass/warn/fail list, Run Deep Audit (with model) and the existing details. The chevron rotates. Clicking again or pressing Esc closes it.
4. The "All fields below belong to this term sheet" subtitle is removed to save room. On narrow screens the row wraps so nothing gets cut off.

## Unchanged
Check rules, Deep Audit behaviour, Try to fix, ignored warnings, and the drop-file bar.

## Technical notes
- `UnifiedDealChecker.tsx`: add a `compact` mode that renders the chip and accepts `open`/`onOpenChange`; the expanded body is the existing details content.
- `DealsPage.tsx`: lay the term sheet header out as a flex row (title, checker chip, TabsList), and render the expanded checker body below it. Rename the label.
- Update `reference/deal-checker-capabilities.md` (UI location note).
