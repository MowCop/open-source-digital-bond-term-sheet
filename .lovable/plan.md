## Problem

In Create New Issue, the AI-generated headline picks the wrong borrower. For a Slovak Republic deal mandated to Raiffeisen Bank (and others), the extractor returns "Raiffeisen Bank" as the borrower. Root causes in `src/lib/alertParsing.ts`:

1. The sovereign pattern only matches `Republic of X` / `Kingdom of X` etc. It does NOT match the reversed form "Slovak Republic", "Czech Republic", "French Republic", "Italian Republic", "Hellenic Republic", "Portuguese Republic", "Argentine Republic".
2. The corporate suffix layer happily matches `Raiffeisen Bank` (ends in `Bank`) and the candidate ranking picks the longest string, so a bookrunner can outrank the true issuer.
3. There is no exclusion of known banks / bookrunners from borrower candidates.
4. Explicit labels like `Issuer:`, `Borrower:`, `Obligor:` are not prioritised.
5. No cross-validation that the chosen borrower actually appears in the source text in an issuer-like context (vs an arranger context).

## Fix Plan (single file: `src/lib/alertParsing.ts`)

### 1. Add label-first extraction (highest priority)
Detect explicit fields anywhere in the text and use them verbatim:
- `Issuer\s*[:\-]\s*<value>`
- `Borrower\s*[:\-]\s*<value>`
- `Obligor\s*[:\-]\s*<value>`
- `Name of Issuer\s*[:\-]\s*<value>`

If found, return immediately (skip heuristic layers).

### 2. Extend sovereign patterns
Add reversed/adjective forms:
- `\b(Slovak|Czech|French|Italian|Hellenic|Portuguese|Argentine|Dominican|Helvetic|Bolivarian|Lebanese|Tunisian|Algerian|Syrian|Iraqi|Yemeni)\s+Republic\b`
- `\b(Swiss|Spanish|Norwegian|Swedish|Danish|Belgian|Dutch|Saudi|Cambodian|Thai|Moroccan|Jordanian|Bhutanese|Tongan|Lesotho)\s+Kingdom\b` (rare but cheap)
- Generic `[A-Z][a-z]+\s+Republic\b` as a last-resort sovereign hint.

### 3. Bookrunner / bank exclusion
Reuse the existing `KNOWN_BANKS` list. Before accepting a corporate-suffix or capitalized-run candidate as the borrower:
- Reject if the candidate matches (or contains) a known bank name.
- Reject if the candidate appears within ~120 chars after the cues `mandated`, `appointed`, `joint lead manager`, `bookrunner`, `global coordinator`, `lead manager`, `arranger` — i.e. it's being introduced as a syndicate member, not the issuer.

### 4. Issuer-cue boost
Boost candidates that appear within ~120 chars BEFORE cues like `mandated`, `has appointed`, `is issuing`, `plans to issue`, `priced`, `launched`, `tap`, `new issue`. The phrase pattern "<X> has mandated …" strongly indicates X is the issuer.

### 5. Re-rank candidates
New ranking (highest wins):
1. Label match (Issuer:/Borrower:)
2. Known supranational
3. Sovereign pattern (incl. new reversed forms)
4. Issuer-cue-boosted candidate (not a known bank)
5. Corporate suffix candidate (not a known bank)
6. Connector-aware capitalized run (not a known bank)

Drop the pure "longest string" tiebreak — use rank first, then leftmost.

### 6. Cross-validation safety net
After picking a borrower, if it matches a `KNOWN_BANKS` entry exactly, discard it and fall back to the next-ranked candidate. This protects `simulateAIExtraction` (which feeds the headline) and `mergeDealFromText`.

## Out of Scope
- No UI changes.
- No changes to `bondValidator.ts`, `DealChecker`, or `AIDraftPage.tsx`.
- No changes to the bookrunner extractor (it already correctly captures Raiffeisen as a bookrunner).

## Verification
- Manually test paste of the Slovak Republic alert → headline should read "The Slovak Republic …".
- Existing happy-path examples ("Republic of Italy …", "European Investment Bank …", a corporate like "Volkswagen AG …") must still resolve correctly.
- Run `bunx vitest run` if any parsing tests exist.
