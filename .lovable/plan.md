# Make scanned PDFs (like Aldar Properties) render like the Slovak Republic doc

## Why the last change didn't appear to do anything

The new `pdfToHtml.ts` heuristics only run when pdf.js can extract a text layer. The Aldar Properties PDF is a **scanned / image-based PDF** — pdf.js returns zero text items, so the code drops straight into the existing image-of-the-page fallback. That's why nothing visibly changed.

PDFs with a real text layer (e.g. exports from Word) already benefit from the new headings / KV-table / bullet detection. Scanned PDFs need a different pipeline: **OCR + layout reconstruction**.

## Approach: vision-model OCR via Lovable AI Gateway

Add a fallback that triggers only when pdf.js returns no text. We rasterise each page in the browser (already working), send the page images to a new edge function, which calls Lovable AI (`google/gemini-2.5-pro` — strong at visual + text reconstruction) and asks it to return clean, structured HTML matching the document's visual layout (h1/h2, paragraphs, bullets, two-column "label: value" tables, simple grid tables).

The result feeds back through the same `appendHtmlToBody` + `applyExtractedText` path, so headline / AI fields / bookrunner extraction continue to work.

No API key needed from the user — Lovable AI Gateway is already wired in.

## Scope

1. **Edge function `pdf-ocr-to-html`** — POST `{ pages: [{ pageNumber, imageBase64 }] }`, returns `{ html, text }`. Streams page-by-page to Lovable AI with a strict prompt: reconstruct the original layout as semantic HTML, prefer `<table class="pdf-kv">` for label/value blocks, no `<style>`/scripts, no commentary. Concatenates per-page HTML.
2. **`src/lib/pdfToHtml.ts`** — when a page yields no text items (or the whole doc yields almost no text), rasterise the page(s) to JPEG (reusing the existing `renderPageImage` helper at scale 2.0 for OCR quality), call the edge function, and return that HTML/text instead of the image fallback.
3. **`src/pages/AIDraftPage.tsx`** — show a clearer "Reading scanned PDF with AI…" toast while the OCR path runs (it's slower than the text-layer path). No other UI changes.

## Out of scope

- PPTX / image uploads (not requested)
- Re-OCRing PDFs that already have a text layer
- Caching OCR results across sessions

## Validation

Re-upload Aldar Properties. Expect: bank/term-sheet style two-column rows for Issuer / Issuer Rating / Format / Pricing Date etc., section headings preserved, the indicative terms table rendered as a real `<table>` — visually comparable to the Slovak Republic output. Re-upload a text-layer PDF and confirm the existing fast path still runs (no edge-function call).

## Files touched

- `supabase/functions/pdf-ocr-to-html/index.ts` (new)
- `src/lib/pdfToHtml.ts` (add OCR fallback branch)
- `src/pages/AIDraftPage.tsx` (toast wording only)
