## Problem

In the term-sheet KV table, when a **label** wraps to a second line (e.g. "Structuring Advisor & Global Coordinator (B&D)"), the wrapped portion ("Coordinator (B&D)") is rendered as a separate heading outside the table, and the next row ("Joint Lead Managers & …") starts a new table. Only **value-column** continuations are currently merged; **label-column** continuations are not.

Root cause in `src/lib/pdfToHtml.ts`:

- `collectKVBlock()` only treats a line as a continuation if every item starts at the value-column X. A line whose items live entirely in the **label column** (left of `valueColX`) breaks the block.
- `renderKVTable()` likewise only merges continuation rows when they sit in the value column.

## Fix

Edit `src/lib/pdfToHtml.ts` only (no UI / CSS changes needed):

1. **Extend `collectKVBlock()`** to also accept a "label continuation" line: a line where every item's `x` is **left of `valueColX - 8`** (i.e. nothing in the value column), and the gap to the previous row is small (≤ ~1.6× medianGap so we don't swallow the next real section). Continue the block in that case.

2. **Extend `renderKVTable()`** to merge those label-continuation lines into the previous row's **label** cell (joined with a space, collapsing whitespace), instead of starting a new row or being dropped.

3. Keep the existing value-column continuation behaviour unchanged (multi-line values like Subordination still merge into the value cell with `<br/>`).

4. Tighten the KV/heading boundary: a line is only treated as a label continuation if its max font size is **not** larger than the table's median (so true H2/H3 headings between tables still break the block correctly).

## Validation

Re-upload the Aldar PDF and confirm:
- "Structuring Advisor & Global Coordinator (B&D)" appears as a **single label cell** with "Citigroup Global Markets Limited" as its value, inside the same bordered table.
- "Joint Lead Managers & Bookrunners" likewise renders as one label cell.
- Single-line labels (Issuer, Format, Coupon, etc.) still render correctly.
- Multi-line **values** (Subordination, Optional Redemption) remain merged in the value cell.
- No regressions on the Slovak Republic PDF.