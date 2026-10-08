# OpenFIGI knowledge, FIGI lookup and Deal Checker rules

## 1. Knowledge library (reference)
- Read https://www.openfigi.com/about/regulations and every regulatory framework it links to, plus the wider OpenFIGI site (about, FIGI structure, API docs).
- Save a project memory `reference/openfigi` covering: what a FIGI is (12 chars, BBG prefix, check digit), its open licence, how the OpenFIGI mapping service works (free, no key needed at low volume, optional key for higher limits), and a per-framework summary (EU/UK MiFID II/MiFIR, EMIR, SFTR; US SEC, CFTC, FINRA TRACE; and any others on the page) with links and the identifiers each one accepts or expects.
- Add the memory to the index next to GLEIF LEI.

## 2. Live FIGI lookup
- New backend function `openfigi-lookup` (same pattern as gleif-lookup): takes up to 25 ISINs, calls OpenFIGI's mapping service and returns the FIGI, composite FIGI, share-class FIGI, name, ticker, security type and market sector.
- Uses an optional OpenFIGI API key only if you add one later; works without it.
- In the Fill tab, when an ISIN is entered and no FIGI is held, show the OpenFIGI match under the identifier with a "Use" button — never filled in automatically (same rule as LEI).
- New bonds are often not on OpenFIGI until close to pricing/settlement, so "not found" before pricing is a note, not an error.

## 3. Deal Checker rules
Added to the same Deal Checker list, tagged "OpenFIGI":
- FIGI format and check digit (offline, instant).
- FIGI matches ISIN on OpenFIGI (live): pass on match, warning on mismatch or service unreachable.
- Reporting-readiness notes by framework: e.g. ISIN + issuer LEI present (MiFIR/EMIR/SFTR), US deals flagged for TRACE/CFTC identifier expectations. Warnings only, never blocking.
- Each line links to the OpenFIGI record.

## Technical details
- FIGI is stored as an identifier entry in the term sheet's identifiers group via existing FIELDS paths — no change to src/lib/termsheet/. If BDT has no FIGI identifier type, it goes in the envelope extension like other ext fields.
- New `src/lib/openfigi.ts` (validFIGI, lookupFigis, figiChecks) with vitest tests for format/check digit and each check outcome.
- `CheckItem.src` gains `'openfigi'`; UnifiedDealChecker debounces lookups (800 ms) like GLEIF.
- AGENTS.md: rule that FIGI checks are hybrid and suggestions are never auto-applied.
- node verify.mjs, node verify-dlt.mjs, vitest and type checks must keep passing.
