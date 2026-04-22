

## Improve Borrower Name Detection + Make Borrower Editable

### Problem

In `src/lib/alertParsing.ts`, `simulateAIExtraction` extracts the borrower with this regex:

```
/([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:\s(?:AG|Inc|PLC|SA|Ltd))?)/
```

It only chains capitalised words, so it stops at the first lowercase connector word. "Federal Republic of Congo" becomes "Federal Republic", and similarly for "Republic of Italy", "Kingdom of Spain", "Bank of America", "European Bank for Reconstruction and Development", etc. Eurofima parses correctly only by accident (single word).

The Master Deal Alerts list also shows `group.borrower` (sourced from `deal.issuerName`) as plain text — there is no way to correct it inline.

### Fix

**1. Smarter borrower extraction in `src/lib/alertParsing.ts`**

Replace the single regex with a layered approach:

- **Sovereign / supranational patterns first** (highest precedence) — match well-known issuer name shapes:
  - `(Federal |Democratic |Islamic |People's )?Republic of [A-Z][\w'-]+(?: and [A-Z][\w'-]+)*`
  - `Kingdom of [A-Z][\w'-]+`
  - `Grand Duchy of [A-Z][\w'-]+`
  - `(State|Commonwealth|Principality|Sultanate|Emirate) of [A-Z][\w'-]+`
  - `United (States|Kingdom|Arab Emirates|Mexican States)(?: of [A-Z][\w'-]+)?`
  - Known multi-word supras: `European Investment Bank`, `European Bank for Reconstruction and Development`, `Asian Development Bank`, `Eurofima`, `KfW`, `Council of Europe Development Bank`, etc. (curated list, easy to extend).
- **Corporate suffix anchor** — `\b([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,5})\s+(AG|Inc|PLC|SA|Ltd|NV|SpA|GmbH|Holdings|Group|Corp|Corporation|Bank|Capital)\b` — captures the full name including the suffix.
- **Connector-aware fallback** — allow lowercase connector words (`of`, `and`, `for`, `the`, `de`, `du`, `la`, `von`, `van`) inside the capitalised run: `[A-Z][\w'-]+(?:\s+(?:[A-Z][\w'-]+|of|and|for|the|de|du|la|von|van)){0,6}` then trim trailing connectors.
- Pick the **longest, leftmost** match across the three layers and use it as the borrower. Verbs like "plans", "prices", "mandates" act as terminators so phrases like "Federal Republic of Congo plans benchmark" yield "Federal Republic of Congo".

This change flows automatically into `mergeDealFromText` → `updateDeal('issuerName', …)`, so newly created and re-parsed alerts get the correct borrower; the AI Field Extraction panel on Create New Alert also benefits.

**2. Backfill existing deals**

On app load (in `AppContext` rehydrate), run the new extractor against each deal's first message body+subject; if it produces a longer borrower name that *starts with* the current `issuerName`, update the deal in place. This corrects the existing Federal Republic of Congo, Republic of Italy, etc. without losing manual edits (we only extend, never overwrite a divergent name).

**3. Inline-editable Borrower column on Master Deal Alerts**

In `src/pages/MessagesPage.tsx`:
- Mirror the existing inline-headline pattern for the Borrower cell (col-span-2).
- Click the borrower name → becomes an `Input` with autofocus.
- Enter / blur saves via `updateDeal(group.dealIds[0], { issuerName: trimmed })`; Escape cancels.
- Only enabled for `canManageMessages` users.
- Updating the parent deal's `issuerName` automatically refreshes the borrower shown on every alert in the thread (since `group.borrower` is derived from `deal.issuerName`).

### Files Touched

- `src/lib/alertParsing.ts` — new `extractBorrowerName(text)` helper; `simulateAIExtraction` uses it.
- `src/context/AppContext.tsx` — one-time backfill pass on rehydrate that extends short borrower names using the new extractor.
- `src/pages/MessagesPage.tsx` — inline editor state for borrower (`editingBorrowerKey`, `borrowerDraft`), saves via existing `updateDeal`.

### Result

- "Federal Republic of Congo plans benchmark 10-year issue" → borrower = **Federal Republic of Congo**.
- "Republic of Italy EUR 1.5bn 10Y BTP" → **Republic of Italy**.
- "Eurofima USD 500m 5Y" → **Eurofima** (unchanged).
- "Deutsche Bank AG announces …" → **Deutsche Bank AG** (suffix anchor).
- Existing mis-parsed deals are auto-corrected on next load; users can also click the Borrower cell on the Master Deal Alerts list to fix any name manually, and the change propagates to every alert in that thread plus the linked Deal Data record.

