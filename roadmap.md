# Roadmap — Digital Term Sheet (ICMA BDT 2.0)

## Agreed architecture
- One validation surface: `checks(state)` first, VDR holiday/settlement/benchmark rules appended to the same list.
- `bdt_state` is authoritative; flat `deals` columns are a derived cache written only on save.
- Release snapshots are immutable rows in `deal_term_sheet_releases`, never JSON in the working state.
- Bridge lives at `src/lib/bdt-bridge.ts`; `src/lib/termsheet/` is vendored and never modified.
- Priority Execution Layer renders `FIELDS` entries selected by path — exactly one definition per field.
- This iteration is fixed-rate single tranche only. No coupon-type switcher.

## Tasks
- [ ] Import Deal Co-Pilot agent, document diffs and automatic reviews using its transfer guide and VDR host template; persist against VDR deals, enforce member access and term-editor approvals, and test end to end. Source located in Your AI Agent Creator; implementation plan awaiting review.
- [x] Board update checker reviews selected text and real attachments; verified Italy/Emirates mismatch in signed-in UI, read-failure and input-isolation tests pass.
- [x] Bond Console > Syndicate Tools: "Edgar SEC filings" live link to the SEC EDGAR 424B filing search (catalogue in src/lib/vendors.ts); planned separate build will queue EDGAR-sourced term sheets for deal creation in the Digital Term Sheet.
- [x] Wire Bond Console to public published SOFR/EFFR, ECB exchange rates and central bank headlines; authenticated loading and refresh verified with source dates. Commercial vendor feeds deferred pending licensed access, per user selection.
- [x] Replace board OrderBook buttons with DTS and verify matching deal/stage navigation into Fill (Priced and Original IPT checked end-to-end on Al Rajhi; stage resolver tests pass).
- [x] Remove term-sheet example placeholders and brighten recorded values, including read-only Announcement; preserve proposal review and source-specific benchmarks (verified on the Al Rajhi Announcement snapshot).
- [x] Restore original Word formatting for Al Rajhi board updates and constrain message widths; verify existing updates.
- [x] Make View reflect the current authoritative Fill values, including accepted document proposals and cleared fields; verify synchronization.
- [x] Update New Deal border, blank defaults, issuer extraction, multi-value entries, and issuer/bookrunner creation requirements; verify the flow.
- [x] Migration: `deals.bdt_state`, `deal_term_sheet_releases` table with RLS and grants.
- [x] Fix `verify.mjs` import paths; confirm reference XML still matches.
- [x] CI workflow running `node verify.mjs` + `xmllint` against `schema/icma-bond-data-taxonomy.xsd`.
- [x] `src/lib/bdt-bridge.ts`: `dealToBdtState`, `bdtToDealCache`, `unifiedChecks`.
- [x] Persist `bdtState` through `types/bond.ts` and the cloud data layer.
- [x] Fill tab rebuilt on the BDT core (stage rail, priority layer, full sections, assisted fill, save).
- [ ] Term Sheet / XML / Envelope / Legends tabs.
- [ ] Release & Audit Log tab writing immutable rows to `deal_term_sheet_releases`.
- [x] Point Deal Checker at `unifiedChecks` so the two surfaces become one in the UI.
- [x] Retired the `fieldConfig.ts` prototype — the BDT FIELDS dictionary is the only field list.
- [ ] Later iteration: floating / zero coupon with dependent fields and validation.
- [x] Al Rajhi demo deal: library files, demo deal setup, chat replay, stage snapshots
- [x] Bond Console > Vendor & Market Data Connectors: "Public Market Data" and "Central Bank News" each collapsible (chevron, starts open).
