## Problem

In the Aldar PDF, the "Interest" row's value wraps across a page break. Page 1 ends with "...the court declaring the Issuer insolvent or" and page 2 starts with "appointing an administrator... customary carve-outs" at x≈217.7 (the value column).

Because `pdfFileToHtml` runs KV/table/paragraph detection **per page**, the continuation at the top of page 2 has no preceding KV row on its own page, so it gets rendered as a plain `<p>` outside any table.

## Fix (single file: `src/lib/pdfToHtml.ts`)

Make KV continuation detection cross page boundaries:

1. After per-page rendering, when a page's first non-repeating lines all sit at a value-column X that matches the **last KV table emitted on the previous page**, treat them as a continuation:
   - Strip them from the current page's lines before running the normal per-page pass.
   - Append their inline-rendered text to the last `<td>` of the previous page's trailing `<table class="pdf-kv">` (joined with `<br/>` or a space).

2. Implementation approach:
   - Track, per page, the dominant `valueColX` of the last KV block rendered and a reference to the rendered table HTML (or restructure to render after computing all blocks).
   - At the start of processing page `p+1`, peek at the first N (≤ ~6) lines; collect a leading run where every item's `x` is within ±8 of the previous page's `valueColX` and no item lies in the label column. Skip lines that are repeating headers/footers (already filtered).
   - Merge those lines into the previous page's last KV row's value cell, then continue normal processing from the first non-continuation line.

3. Guard rails:
   - Only merge if the previous page's final output element was a `pdf-kv` table (not a heading or paragraph).
   - Only merge if font size of continuation lines matches the table's body size (don't swallow a new heading at top of page).
   - Stop the leading run at the first line that breaks the value-column alignment.

## Validation

Re-upload the Aldar PDF and confirm:
- The "Interest" row's value cell contains the full wrapped text ending in "...all subject to customary carve-outs" inside the bordered cell.
- No orphan paragraph appears between the Interest table and the next table on page 2.
- Single-page KV rows and multi-line values within one page still render correctly.
- No regression on the Slovak Republic PDF.