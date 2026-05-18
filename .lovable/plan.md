## Diagnosis
- The Aldar PDF is not image-only: it contains a text layer with ~141 text items on page 1.
- Because of that, the scanned-PDF OCR fallback is not triggered; the `pdf-ocr-to-html` function has no logs and no network call was made.
- The current text-layer parser only treats a row as label/value when it sees a large gap between adjacent text items. In this PDF, `pdf.js` emits a giant whitespace item between the label and value, so the gap test is missed and all rows collapse into normal paragraphs.
- Some values span multiple lines; the current key/value block collector does not attach continuation lines to the preceding label row.
- Styling also differs from the Slovak Republic example because `.pdf-kv` is currently borderless, while the desired output uses visible table borders, padding, and label/value indentation.

## Plan
1. **Fix PDF key/value detection for Aldar-style text layers**
   - Update `src/lib/pdfToHtml.ts` so whitespace-only PDF items are ignored for layout decisions.
   - Detect two-column rows by absolute column positions as well as gaps, not only by adjacent-item spacing.
   - For Aldar-like term sheets, identify the repeated label column around the left side and the value column around the right side.

2. **Preserve multi-line values inside the same labelled row**
   - When a labelled row is followed by indented continuation lines in the value column, merge those continuation lines into the same table cell.
   - This will keep rows like `Subordination`, `Interest Rate`, and `Optional Redemption` as one bordered row with wrapped value text instead of separate paragraphs.

3. **Render the output like the Slovak Republic example**
   - Keep the imported content as semantic HTML tables (`<table class="pdf-kv">`).
   - Update `src/index.css` so `.pdf-kv` has visible borders, full width, row padding, a stable label column, and readable indentation matching the Slovak Republic screen.

4. **Keep OCR fallback, but reserve it for true image/scanned PDFs**
   - Leave the existing vision OCR path in place for PDFs with no usable text layer.
   - The Aldar PDF should use the improved fast text-layer reconstruction instead of expensive OCR.

5. **Validate with the attached Aldar PDF**
   - Run the parser against the attached file and inspect the generated HTML shape.
   - Confirm the Create New Issue editor receives a bordered label/value table instead of one long paragraph.

## Expected result
Dropping the Aldar Properties PDF should produce a title plus a bordered two-column table with rows such as:
- Issuer | Aldar Properties PJSC
- Issuer LEI | 98450048CD8AEF13B480
- Company Rating (Moody’s) | Baa2 (Stable)
- Notes | Resettable Subordinated Notes due 2056
- Subordination | Direct, unsecured... [wrapped within the same value cell]

This should visually match the Slovak Republic output style much more closely.