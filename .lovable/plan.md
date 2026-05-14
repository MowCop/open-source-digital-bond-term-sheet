# Fix: PDF drop in Create New Issue does nothing

## Root cause

In `src/pages/AIDraftPage.tsx`, `handleFiles` only extracts text from `.docx` files (via `mammoth`). PDFs and PPTs are added to the attachments list but their contents are never read, so `simulateAIExtraction` is never called → no headline, no body, no AI fields.

The placeholder advertises "PDF, Word, or PPT" — only Word actually works today.

## Validation against the Aldar term sheet

Parsed the uploaded `Aldar Properties PJSC Pricing Term Sheet`:

- It is a **text-based PDF** (not scanned). Client-side text extraction will return clean text — no OCR / AI fallback needed.
- Contains explicit labelled rows that map directly to fields the existing parser already understands:
  - `Issuer: Aldar Properties PJSC` → caught by the Layer 0 label rule we just added to `extractBorrowerName`
  - `Issuer LEI`, `Company/Issue Rating`, `Issue Size`, `Issue Price`, `Re-offer Yield`, `Re-offer Price`, `Pricing Date`, `Issue Date`, `Maturity Date`, `Denomination`, `Governing Law`, `Listing`, `ISIN`
  - `Joint Lead Managers & Bookrunners: Abu Dhabi Commercial Bank PJSC, Citigroup …, Emirates NBD …, FAB …, Intesa …, J.P. Morgan …, Mashreq, SocGen, Standard Chartered, RAKBank` → matches `extractBookrunners`
  - `Structuring Advisor & Global Coordinator (B&D): Citigroup` → GC flag

So the only missing piece is feeding this PDF's text into the existing pipeline.

## Scope

One file change: `src/pages/AIDraftPage.tsx`. No backend, no AI gateway call, no changes to `alertParsing.ts`, `DealChecker`, or types.

## Implementation

1. Add `pdfjs-dist` (already common in Lovable projects; small, browser-side).
2. In `handleFiles`, branch by extension:
   - `.docx` → existing `mammoth` path (unchanged).
   - `.pdf` → dynamically `import('pdfjs-dist')`, configure the worker via `?url`, load the `ArrayBuffer`, iterate pages, concatenate `textContent.items[].str` with newlines, then call the existing `applyExtractedText(text, file.name)`.
   - `.pptx` → out of scope for this fix; update placeholder text to "PDF or Word" so we don't promise something that doesn't work yet (PPT can be a follow-up).
3. Show the existing "Extracting headline, body, and deal fields from attachment…" spinner during PDF parse (reuse `isExtractingAttachment`).
4. On parse failure, fire the existing destructive toast and keep the file attached so the user can still send it.

```text
handleFiles(files)
 ├── attach all files (current behaviour)
 ├── for each .docx → mammoth.extractRawText → applyExtractedText
 ├── for each .pdf  → pdfjs getDocument → page.getTextContent → applyExtractedText
 └── toast summary
```

## Acceptance criteria

- Drop the Aldar PDF onto the panel → headline auto-fills (something like "Aldar Properties PJSC …"), body fills with the term-sheet text, AI Field Extraction shows Issuer = Aldar Properties PJSC, LEI, ratings, size, price, dates, ISIN, listing, governing law, denomination, and the bookrunner list including Citigroup tagged as GC.
- Drop a `.docx` → behaviour unchanged.
- Drop a non-text/scanned PDF → file still attaches, destructive toast surfaces "could not be read", no crash.
- No regressions in `simulateAIExtraction`, `extractBorrowerName`, `extractBookrunners`, or `DealChecker`.

## Out of scope

- `.pptx` extraction (placeholder will be updated to reflect this; can be added next).
- Server-side / Gemini OCR fallback for scanned PDFs (can be added later if users hit image-only PDFs).
- Any change to deal creation, validation, or chat flows.
