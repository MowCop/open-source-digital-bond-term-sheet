# Fix: Issuer mis-extracted as "United Arab Emirates" on Aldar PDF

## Root cause

When a PDF term-sheet's Issuer row is rendered as an HTML KV table and then stripped to plain text, the result is `… Issuer Aldar Properties PJSC Issuer LEI 98450048… …` — label and value separated only by whitespace, no colon.

`extractByLabel()` in `src/lib/alertParsing.ts` only accepts `Issuer\s*[:\-–]\s*…`, so the labelled value is missed. Extraction falls through to the sovereign-pattern layer, which matches **"United Arab Emirates"** inside the boilerplate "(a public joint stock company incorporated in the United Arab Emirates)".

The KV-table heading "Issuer" is the strongest possible signal — it must always win over generic sovereign / connector patterns.

## Changes

### `src/lib/alertParsing.ts`

1. Loosen `extractByLabel()` to accept whitespace-only separators (typical of table flattening), in addition to `:`, `-`, `–`:
   - Match `Issuer` (and `Borrower`, `Obligor`) followed by 1+ spaces OR a colon/dash, then capture up to the next known field label.
   - Disambiguate from sibling labels: do **not** match when the next word is `LEI`, `Rating`, `Name`, `Type`, `Group`, or any of the existing follow-on field labels already used in the split regex.
   - Keep the existing terminator-split so the value stops at the next labelled field on the same line.

2. Reject obviously-wrong matches:
   - If the captured value is empty, a known bank, or matches a sovereign-only phrase like "United Arab Emirates" / "Republic of …" / "Kingdom of …", treat the label match as not-found and continue (lets the fallback still help in genuinely sovereign PDFs that happen to have an `Issuer:` line elsewhere).

3. No changes to the sovereign / corporate / connector fallback layers — they remain the safety net for non-term-sheet alerts (e.g. press wires that don't carry an "Issuer" label).

### No other files changed

`simulateAIExtraction`, `AIDraftPage`, and the PDF→HTML pipeline are untouched. The fix is purely in the regex / disambiguation logic.

## Validation

1. Re-upload the Aldar Properties PJSC Pricing Term Sheet — Issuer Name should be `Aldar Properties PJSC`, headline should start with it, and the AI Field Extraction panel should show the same.
2. Re-upload the Slovak Republic term sheet previously tested — Issuer must still resolve to `Slovak Republic` (sovereign fallback when no `Issuer` row exists, or the labelled row when it does).
3. Paste a free-text alert ("Republic of Italy mandated JPMorgan…") with no Issuer label — must still resolve to `Republic of Italy`.
