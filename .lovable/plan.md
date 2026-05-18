## Short answer

Yes — we can get PDFs much closer to the Slovak Republic (DOCX) look, but not 1:1. DOCX carries real semantics (Heading 1, lists, tables, bold runs), so mammoth maps it cleanly to HTML. A PDF only contains positioned glyphs and drawing ops — there are no "paragraphs", "headings" or "tables" in the file, just text at coordinates. Everything has to be reconstructed by heuristics.

Our current `pdfToHtml.ts` already does a first pass (line grouping, heading-by-font-size, bold detection, naive tables, optional rasterized logo). It works on simple PDFs but loses fidelity on bank term sheets like Aldar, where layout is dense and multi-column.

## What "matching the Slovak look" means for PDF input

The Slovak DOCX output preserves:
1. Centered title block with logos
2. Bold section headings (ISSUER, GUARANTOR, …) in their own line
3. Two-column "label : value" rows
4. Bullet lists
5. Inline bold inside paragraphs
6. Tables with borders

To reach that from PDF we need a stronger reconstruction pipeline, not a different library.

## Proposed upgrade to `src/lib/pdfToHtml.ts`

### 1. Better line + block grouping
- Cluster by Y with a tolerance proportional to font size (not a flat 3pt) so 10pt body and 18pt headings both group correctly.
- Detect blank-line gaps (>1.5× median line height) and emit paragraph breaks instead of joining everything.

### 2. Two-column "label : value" detection (the big win for term sheets)
Aldar's term sheet — like most DCM docs — is laid out as:

```
Issuer:              Aldar Investment Properties Sole Proprietorship LLC
Guarantor:           Aldar Properties PJSC
Issue Size:          USD 500,000,000
```

Heuristic: within a page, find the dominant X position of the second token group across many lines. If ≥4 lines share roughly the same "left column ends here / right column starts here" boundary, render those lines as a 2-column borderless table (or a `<dl>`). This is what makes the output *look* like the source instead of a wall of text.

### 3. Bullet detection
Lines starting with `•`, `·`, `-`, `–`, `o`, `▪` or `(i)/(ii)/(a)` → wrap into `<ul>`/`<ol>` with the bullet stripped. Indented continuation lines join the previous `<li>`.

### 4. Table detection — upgrade
Current code only triggers on >30pt gaps. Add:
- Use ruling lines from `getOperatorList` (stroke ops) when present — gives exact column/row boundaries.
- Fall back to X-cluster method already in place, but cluster across the whole page first, then assign rows.

### 5. Heading detection — upgrade
- Compare against per-page median font size, not document median (cover pages skew it).
- Treat ALL-CAPS short lines (<60 chars) as `<h2>` even without size jump — matches "ISSUER", "RISK FACTORS" style.
- Centered + bold + large = `<h1>`, used once per page max.

### 6. Inline bold runs
Today a line is "all bold or not". Change to per-item: build the line as a sequence of `<strong>`/plain `<span>` runs so "Issuer: **Aldar…**" keeps the bold on the value only.

### 7. Logo / image preservation
Already rasterizing the whole page when an image op is detected. Improve by:
- Extracting just the image XObject (via `commonObjs`/`objs` resolution) instead of rasterizing the whole page, so the logo isn't surrounded by faint background text.
- Only inline images >32×32 px to skip decorative rules.

### 8. Hyphenation & soft wraps
Join lines that end with `-` followed by lowercase on the next line; otherwise keep paragraph wrapping as soft breaks within one `<p>`.

## What still won't be perfect (be honest with the user)

- **Exact fonts & colors** — we render in the editor's theme, not the PDF's typeface. Slovak DOCX has the same limitation; mammoth strips fonts too, so output looks consistent with current behavior.
- **Complex multi-column prospectuses** (e.g. 2-column body with footnotes) — reading order can break. We can detect column count from X histogram and process columns separately.
- **Scanned / image-only PDFs** — no text layer to extract. We already fall back to a page image; OCR (tesseract.js) could be added later behind a "scanned PDF detected" toggle, but it's heavy (~10MB worker) and slow.
- **Footers, page numbers, running headers** — will appear inline unless we filter. Add a pass that drops text repeated at the same Y on ≥50% of pages.

## Files touched

- `src/lib/pdfToHtml.ts` — rewrite the reconstruction pipeline (sections 1–8 above). No new dependencies; pdf.js already exposes everything we need.
- `src/index.css` — minor: add styling for `.pdf-kv` (the borderless 2-col label/value table) so it matches the Slovak look in the editor.
- No changes to `RichTextEditor.tsx`, `AIDraftPage.tsx`, or the DOCX path.

## Out of scope for this pass

- OCR for scanned PDFs (separate follow-up if needed).
- PPTX import (still listed in the Attachment type but not wired).
- Server-side conversion via LibreOffice — would give pixel-perfect fidelity but requires an edge function with a LibreOffice binary; only worth it if heuristic approach proves insufficient on real documents.

## Suggested validation

After implementing, drop both attached files into Create New Issue and compare side-by-side with the originals. If Aldar's key-value block renders as a clean two-column layout with bold values, we've hit the target.
