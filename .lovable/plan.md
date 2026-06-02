## Problem

When dropping `MBH Priced.docx` into Create New Issue, the body correctly shows:

> Subject: €€€ MBH Bank EUR 500m RegS 5NC4 Senior Preferred - Priced €€€

…but the headline is auto-built from the regex baseline as `"MBH Bank Nyrt. — New Issue Alert"`, throwing away the full deal descriptor (size, tranche, format, stage) that the source document actually provides on its Subject line.

Root cause: `applyExtractedText` in `src/pages/AIDraftPage.tsx` builds the headline from `simulateAIExtraction()` (issuer + size + tenor + stage) and never looks at an explicit `Subject:` line in the document, even though almost every real new-issue announcement leads with one.

## Fix

### 1. `src/lib/alertParsing.ts` — add a Subject-line extractor

Add and export a small helper:

```text
extractSubjectLine(rawText): string
```

- Scan the first ~30 lines for the first line matching `/^\s*Subject\s*[:\-]\s*(.+)$/im`.
- Trim wrapping decoration: leading/trailing `€€€`, `***`, `###`, `>>>`, `<<<`, surrounding quotes, and collapse whitespace.
- Return `''` if nothing usable found, or if the cleaned result is shorter than ~10 chars.

### 2. `src/pages/AIDraftPage.tsx` — prefer the Subject line as headline

In `applyExtractedText` (around the `subjectLine` block, ~line 193):

- Compute `const docSubject = extractSubjectLine(clean);`
- New precedence for `subjectLine`:
  1. `docSubject` (if non-empty)
  2. existing `baseline.headline` (when it isn't the generic `Issuer …` fallback)
  3. filename fallback
- In the AI-issuer post-step (~line 228-239), only replace the headline with `"{aiIssuer} — New Issue Alert"` when **no `docSubject`** was found AND the current headline is the generic placeholder. Otherwise leave the user/Subject-derived headline alone.

### 3. Behaviour guarantees

- Drag-and-drop of `MBH Priced.docx` → headline becomes `"MBH Bank EUR 500m RegS 5NC4 Senior Preferred - Priced"` instead of `"MBH Bank Nyrt. — New Issue Alert"`.
- Documents without a Subject: line keep the current behaviour (issuer-based headline).
- A user who has already manually typed a headline is still never overwritten (the existing `if (!trimmed) …` guard is preserved).

### 4. Out of scope

- No edge function changes; this is a client-side parsing fix.
- No changes to AI field extraction or bookrunner parsing.
- No DB / schema work.

### Files touched

- `src/lib/alertParsing.ts` — add `extractSubjectLine` + export.
- `src/pages/AIDraftPage.tsx` — use it inside `applyExtractedText`.
