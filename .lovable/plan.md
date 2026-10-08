# Suggest an LEI from GLEIF when a party name is entered

## What the user gets
- In the Fill tab party list, when a party's **Legal name** is filled in and its **LEI** box is empty, the app searches GLEIF's register by name about a second after typing stops.
- Matches show under the LEI box as suggestions: legal name, country, status (Active/Lapsed) and the LEI code. There are up to 5.
- Clicking **Use** fills the LEI box. Nothing is filled without a click, because names like "Bloomberg" match several entities.
- If there's exactly one active match whose name matches, it gets a "Best match" badge. The user still has to click it.
- The Deal Checker gets a new warning, "Party X has no LEI — N GLEIF matches found", with a link to the suggestions.
- After **Use** is clicked, the existing live GLEIF check confirms the code (active and the name matches).
- If GLEIF can't be reached, no suggestions appear and typing is never slowed down.

## Scope
- This applies to every party (issuer/borrower, guarantor, managers, and so on), since the same LEI box is used for all of them.
- Nothing in the vendored term sheet folder changes.

## Technical details
- Edge function `gleif-lookup` gains a `search` mode: `{ name, country? }` calls `https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=…&page[size]=5`. If there are no exact hits, it falls back to `filter[fulltext]`. It returns `{lei, legalName, country, entityStatus, registrationStatus}[]`. Name-search through this endpoint has been confirmed to work.
- `src/lib/gleif.ts`: add `searchLeiByName(name, country)` and `rankCandidates()`, which reuses `namesMatch` and puts active entities first.
- New `src/components/termsheet/LeiSuggest.tsx`: shown under the LEI input in the party GroupEditor. It waits 800ms after typing stops, caches results per name, and **Use** writes the LEI through the existing field setter, so autosave and history behave as normal.
- The Deal Checker warning is appended in `UnifiedDealChecker` with `src: 'gleif'`.
- Vitest tests for ranking (active above lapsed, best-match rule) and the no-LEI warning.
- Add one line to AGENTS.md: LEI suggestions are never auto-applied.
