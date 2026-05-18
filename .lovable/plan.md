## Goal

When users drag PDF / Word files onto the Create New Issue compose pane, the body should mirror the original document's formatting — headings, bold/italic, paragraph breaks, tables, and embedded logos/images — instead of the current flat plain-text dump.

The Aldar Properties term sheet screenshot is a representative example: bordered two-column table of terms, centred title in bold, italic sub-line, embedded logo. All of that should appear in the body pane after drop.

## Approach

### 1. Swap the body editor for a rich-text editor

Replace the `Textarea` in `src/pages/AIDraftPage.tsx` (write mode) with the existing `RichTextEditor` (TipTap). Body state moves from plain text to HTML.

Add Tiptap table + image support so dropped-in content can render:
- `@tiptap/extension-table`, `table-row`, `table-cell`, `table-header`
- `@tiptap/extension-image` (inline base64 images for logos)

Extend `RichTextEditor` to register these extensions and accept an optional `onReady(editor)` callback so the page can call `editor.commands.insertContent(html)` when a file is dropped.

Preview mode renders the HTML via `dangerouslySetInnerHTML` (already have `htmlText.ts` `isHtml` helper) wrapped in the same `prose` classes used by the editor, so it looks identical.

### 2. Word (.docx) → HTML with mammoth

`mammoth` is already installed. Switch from `extractRawText` to `convertToHtml`, which preserves:
- headings, paragraphs, bold/italic, lists
- tables (rendered as real `<table>`)
- embedded images (we convert them to inline base64 data URIs via mammoth's `convertImage` option)

The returned HTML is inserted into the editor; the AI extraction continues to run on a plain-text version (`stripHtml`) so deal-field parsing keeps working unchanged.

### 3. PDF → HTML via pdf.js

Two complementary techniques, picked per file:

a) **Text + layout reconstruction** (default). Use `pdf.js`'s `getTextContent()` plus item transforms to:
   - group items by Y position into lines and by X gaps into columns
   - detect simple tables (≥2 consistent column gaps across consecutive lines) and emit `<table><tr><td>` instead of plain runs
   - infer headings/bold from `fontName` containing `Bold` and from font size above the page median
   - emit a `<h2>` for centred large-font lines, `<strong>` for bold runs, `<p>` for body lines

b) **Image fallback for pages with significant graphics** (e.g. the Aldar logo page). For each page, also render a low-DPI canvas snapshot and detect non-text regions; if the page contains an embedded image element (via `page.getOperatorList()` with `OPS.paintImageXObject`), render that page as a single `<img>` data URI prepended above the reconstructed text. This keeps the logo visible without trying to vectorise it.

Both routes produce one HTML blob per file, joined with `<hr>` between files, and inserted at the current editor caret.

### 4. Drop pipeline changes in AIDraftPage.tsx

- `handleFiles` builds `htmlChunks: string[]`; after extraction it calls `editor.commands.insertContent(htmlChunks.join('<hr>'))` instead of appending to a plain-text body.
- A plain-text mirror is still computed (`stripHtml(html)`) and fed into `simulateAIExtraction` so the right-hand AI Field Extraction panel keeps populating.
- Headline auto-fill logic is unchanged (still uses extracted plain text + filename).
- The attachment chip strip and drop overlay stay as they are.

### 5. Saving / sending

`createMessage({ body })` already accepts a string; downstream renderers in the inbox use `LinkifiedText` on plain text. We update message rendering paths that show the body (inbox / preview / alert history card) to detect HTML via `isHtml()` and render with `dangerouslySetInnerHTML` inside a `prose prose-sm` wrapper, falling back to `LinkifiedText` for legacy plain-text messages. No DB shape change.

## Files touched

- `src/pages/AIDraftPage.tsx` — swap Textarea for RichTextEditor; HTML body state; new drop pipeline that inserts HTML.
- `src/components/RichTextEditor.tsx` — register Table + Image extensions; expose `onReady(editor)`.
- `src/lib/docxToHtml.ts` *(new)* — thin wrapper over `mammoth.convertToHtml` with inline-image conversion.
- `src/lib/pdfToHtml.ts` *(new)* — pdf.js → HTML reconstruction (lines, bold/heading inference, table detection, embedded-image fallback).
- `src/components/AlertHistoryCard.tsx`, `src/pages/InboxPage.tsx`, `src/pages/MessagesPage.tsx` — render HTML bodies through `isHtml()` + `prose` wrapper; keep plain-text fallback.
- `package.json` — add `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`, `@tiptap/extension-image`.

## Limits worth flagging up front

- PDF reconstruction is heuristic. Simple term-sheet tables and headed pages (like Aldar) will look very close to the original; multi-column marketing PDFs with complex layout will still come out approximate.
- Fonts default to the app's stack — exact typefaces from the source PDF aren't preserved, only weight/size hierarchy.
- Scanned (image-only) PDFs have no extractable text; we'll fall back to embedding each page as an image.

Let me know if you'd rather always embed PDFs as page images (perfect fidelity, but not editable / searchable) instead of the reconstruction route.
