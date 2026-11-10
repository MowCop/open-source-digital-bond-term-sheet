# Multi-tranche DTS: one deal, several live term sheets

## Scope of this step
Design and workflow proposal only. Do not change the application, database, validation rules or send any messages until approved. Retain the existing Bond Console arrangement.

## What the current library supports
- The local ICMA BDT 2.0 XSD permits repeated `IssuanceDataGroup` elements and includes series/tranche/class structures, fixed-rate and floating-rate data.
- The current app instead holds one flat BDT field map and one product per deal. Typing “multi tranche” today does not create separate instruments. The present XML exporter likewise builds a single issuance group.
- The dictionary contains **197 entries**, including **24 execution extensions** and **5 repeating-group entries**. This is not 197 distinct official BDT fields, nor the entire XSD. Preserve the complete dictionary; map any missing floating-rate fields against the XSD in the app adapter without editing the vendored library.
- The ICMA Primary Market Handbook, May 2026 edition, remains the preferred workflow reference; transaction documentation and applicable law prevail.

## Recommended banker experience

### 1. Confirm the borrower, then build the deal
Keep New Deal lightweight and its existing issuer/bookrunner requirements. After confirming the borrower, open a short **Deal structure** dialog, whether entered manually or suggested by a document:
- **How many tranches?** Numeric stepper, initially 1; support at least 10 without squeezing them onto one screen.
- **What rate type?** Fixed / Floating selection per tranche, with a single “Apply to all” choice for simple deals. Mixed deals need separate choices, not one deal-wide rate type.
- **Aggregate amount and currency?** Optional planned total; allow “not yet determined” rather than inventing a size. Enter separate currency totals for multi-currency deals; never add unlike currencies or silently convert them.
- **USD equivalent:** alongside the per-currency totals, show an optional **USD equivalent** of the whole deal (and per tranche in the comparison table). It is always labelled "indicative", shows the FX rate, its source and the rate date/time, and can be entered by the banker or filled from a public FX reference (e.g. ECB reference rates, cross-rated to USD) that the banker confirms. USD tranches need no conversion. The USD equivalent is display/reporting metadata only: it never replaces the legal currency amounts in BDT, is not exported as an issued amount, and is frozen into each saved snapshot so bulletins and alerts show the rate actually used. At pricing, the banker can lock the final FX rate (e.g. pricing-date rate per the documentation); Deal Checker warns if the rate is stale or missing for a multi-currency deal.
- Show a small editable list of tranches: label, rate type, currency and optional amount/tenor. No long questionnaire at this stage.
- Documents suggest the number, rate types and available terms with source evidence. The banker confirms the structure even when extraction appears complete; unresolved information stays blank.
- A document that names a financing vehicle must not replace the confirmed short borrower heading. Preserve the legal issuer on each instrument; permit a tranche-specific issuer/guarantor where the documentation requires it.

**Create term sheets** produces partially filled drafts, not automatic public releases. Retain manual editing and add/duplicate/reorder/remove tranche controls. Removing a populated tranche requires confirmation; preserve its released history. Duplication copies chosen commercial terms, never unique security identifiers.

### 2. Make the current View tab the working screen
Rename **View → Deal term sheets**, make it the default, and rename **Fill → All fields**.

```text
Sasol                              Stage · Save · Bulletin
Deal Checker: 2 errors · 3 warnings          Attach document

Deal term sheets | All fields | BDT XML | DLT view | Documents

Shared deal terms: borrower · bookrunners · planned totals

Tranche   Currency / Amount   Type       Tenor    IPT / Guidance
A         ...                 Fixed      ...      ...
B         ...                 Floating   ...      ...

Selected tranche: B
Key commercial terms → Interest terms → Legal / identifiers
```

- An unframed comparison table gives the whole-deal overview. Selecting a row opens one editable term sheet below it. Ten tranches do not mean ten large forms stacked vertically.
- On smaller screens, use a tranche selector and compact summary list instead of a wide comparison table. Keep the selected tranche, stage and Save action visible while scrolling.
- Fixed-rate templates show coupon, frequency, day count, maturity and relevant pricing fields. Floating-rate templates show benchmark/reference rate, margin, reset/fixing conventions, frequency, day count, maturity and applicable caps/floors.
- Template fields are views of the BDT record, not independent Word forms or a second store. Missing facts remain empty. Saved snapshots power public presentation and messaging; unsaved edits stay private and visibly marked.
- Keep an explicit banker-controlled publication action. Partially filled announcement-stage terms may be published only after the existing appropriate review; do not require final pricing data prematurely.

### 3. All fields stays available, without duplicate data
- Retain all 197 dictionary entries in a searchable, sectioned library, with **Shared deal / Selected tranche** scope controls.
- Rate-specific sections are shown according to the selected instrument; inapplicable fields are tucked away rather than deleted. Switching rate type preserves recorded values privately and requires review before discarding anything; inactive fixed-rate values must not leak into a floating-rate export, or vice versa.
- Edits in Deal term sheets and All fields update the same unsaved record immediately in either direction. There is no “copy back” step, automatic save or competing master field store.
- Shared defaults can be applied across tranches; explicit tranche overrides remain visible and protected. Editing a shared value must preview affected tranches and never overwrite overrides silently. Legal clauses, ratings, currencies and dates must not be assumed shared simply for convenience.

### 4. Make checks and documents compact
- Replace the expanded Deal Checker block with one collapsed status line showing errors/warnings for **this deal and all its active tranches**. Clicking opens the detailed findings; passing checks start hidden.
- Findings identify Shared deal or the exact tranche and link to its field. Preserve existing deterministic checks, GLEIF/OpenFIGI, fixes, permissions and on-demand AI audit; AI audit does not become an automatic background action.
- Compute current deterministic checks continuously; reuse shared lookups and avoid repeating network requests per tranche. Add aggregate-versus-tranche amount reconciliation by currency, distinguishing intended/unknown totals from definite mismatches.
- Replace the large drop panel with a compact attachment action and file count. Files can be dropped anywhere inside the currently open DTS area, across tabs, with a temporary drop highlight; prevent accidental browser navigation.
- Retain private document storage and human review. A document can apply to the whole deal, one tranche or several selected tranches. Ask where to apply ambiguous proposals; do not duplicate uploads or overwrite accepted entries.

### 5. One bulletin for the entire deal
- Begin an internal draft from confirmed structure and recorded terms; update its structured tranche table as the deal evolves, while preserving banker-written intro/notes and sourced legal notices.
- **Create New Issue Bulletin** uses the latest saved whole-deal snapshot: shared announcement text followed by a comparison table covering every included tranche and any tranche-specific notices.
- Show missing values honestly; preserve existing saved/draft/public distinctions. Do not publish or email in the background.
- Prepare the same deal snapshot for email and a future Bloomberg message channel. Bloomberg delivery is not currently implemented and is not enabled by this redesign.
- **Later reminder:** ask Karl about richer Send Update previews and additional alert features after the core design is agreed. Keep existing human approval, sender identity, BCC chunking, provider selection and send logging unchanged until that follow-up is specified.

## Technical design for implementation after approval
### Authoritative record and compatibility
- Introduce a versioned deal workspace containing shared BDT defaults and an ordered collection of stable tranche IDs. Each tranche has its own BDT values, repeating groups, rate type and explicit overrides. Materialise a complete BDT state per tranche for existing pure validators/renderers.
- Store workflow metadata and execution-only fields outside the official BDT payload. Use the current Cloud-backed deal record with a versioned JSON structure initially; no separate duplicate template store.
- Existing `deals.bdt_state` records become one-tranche workspaces losslessly through an adapter. Do not rewrite immutable historical releases. Old release/Board links still render the original snapshot; new releases capture the full deal and tranche ordering atomically.
- Keep flat deal columns as derived summaries only; never concatenate several security IDs into a single authoritative ISIN field. Audit edits with deal ID, tranche ID where relevant and before/after values. Preserve current access rules.
- Save the workspace as one version and detect stale concurrent edits. Public pages, bulletins and alerts read only that saved version. Retry sends reuse the original whole-deal snapshot, not current working terms.

### BDT export and product coverage
- Add a deal-aware export adapter that emits one document header and repeated `IssuanceDataGroup` elements, with one fully resolved product per tranche. Verify grouping, shared parties, identifiers, totals and series/tranche identifiers against the local XSD using concrete mixed-tranche fixtures before shipping.
- Audit the existing dictionary and exporter against the fixed/floating branches; add any missing canonical paths in a focused adapter dictionary derived from the XSD, retaining one definition per field and the immutable vendored core.
- JSON and XML exports must preserve all tranches and never collapse to the first product. Update XML preview, alerts and read-only MCP/API outputs consistently. DLT-specific views retain tranche scope without inventing unsupported structures.
- Initial templates: **Fixed** and **Floating**. BDT distinguishes `FLOATING` from `VARIABLE`; do not treat every variable or structured coupon as a standard floating-rate note. Other coupon/product structures need explicit later profiles and validation; this proposal does not claim full ABS coverage.

### Likely files affected
New focused modules/components (names provisional):
- `src/lib/dealWorkspace.ts`: versioned model, legacy adapter, shared resolution and tranche operations.
- `src/lib/trancheTemplates.ts`: canonical fixed/floating field selection and applicability.
- `src/components/termsheet/DealStructureDialog.tsx` and `DealTermSheets.tsx`: setup and active term sheets.
- `src/lib/taxonomy/dealExporter.ts`: portable multi-issuance export.

Existing files/areas:
- `src/types/bond.ts`, `src/lib/bdt-bridge.ts`, `src/lib/termSheetView.ts`, `src/lib/newDeal.ts`, `src/pages/DealsPage.tsx` and Cloud save/load code.
- `src/components/termsheet/TermSheetFill.tsx`, `UnifiedDealChecker.tsx`, document controls, XML panel and tranche-dependent DLT view.
- `src/lib/documentIntake.ts`, `extract-deal-fields-ai`, checker navigation/fixes, Co-Pilot context/proposals and AI audit: carry stable tranche targets throughout.
- `src/lib/bulletin.ts`, `bulletinDraft.ts`, `newIssueAlerts.ts`, release/export helpers and relevant alert functions: consume whole-deal snapshots while retaining approval rules.
- Read-only MCP/API serializers and Board navigation: maintain backward compatibility and prevent single-tranche truncation.
- `AGENTS.md`, `roadmap.md`, `reference/deal-checker-capabilities.md` and DTS workflow documentation after implementation.
- Only if new snapshot columns or persistence functions are needed: an additive migration with current access policies and explicit grants; no destructive history migration.

### Tests and verification
- One fixed tranche, one floating tranche, a mixed two-tranche deal and ten independently editable tranches.
- Manual setup works without documents or amount; uncertain extracted structure remains a proposal; accepted/user-entered data is never overwritten.
- Shared changes affect inherited values only; tranche overrides and legal issuers stay intact; both editing tabs agree, including cleared fields.
- Add/duplicate/reorder/remove keeps stable targets; duplication does not copy ISIN/other unique identifiers; rate switching does not export inactive fields.
- Same-currency totals reconcile exactly; multi-currency totals stay separate; unknown amounts are not treated as zero or guessed allocations.
- Save/reload and version conflicts preserve every tranche; legacy one-tranche records and immutable history still display accurately.
- Combined XML validates against the official local XSD; JSON, public display, bulletin and read-only API output include all tranches.
- Checks are scoped to the current deal and correct tranche; fixes/proposals cannot affect another tranche or bypass human approval.
- Whole-deal bulletins use saved terms, preserve notes/legal notices and do not send automatically; alert logs/retries retain the exact snapshot used.
- Signed-in end-to-end: drop a mixed-tranche document anywhere in DTS → confirm borrower/structure → review proposals → edit both rate types → save/reload → inspect bulletin/publication preview. Test desktop and smaller screens with ten tranches.

## Origin Markets references and delivery order
The public Airbrush README includes a standardised DOCX, a machine-readable Jinja DOCX, examples and a Python generator. These can inform layout and document generation, not replace BDT fields or become a persistent Python service in this app. Check licences and map any reused logic to BDT; do not inherit outdated Airbrush assumptions.

Remind Karl to connect Google Drive's **VDR project folder** for the actual supplied templates/code. Those files have not been inspected yet; their review is a dependency, not a reason to invent content or delay the BDT-first structure.

Recommended order:
1. Agree setup dialog and Deal term sheets layout; inspect supplied examples when available.
2. Build the versioned multi-tranche model, adapters and fixed/floating exports with legacy tests.
3. Add setup/templates, synced All fields, compact checker and anywhere-drop intake.
4. Complete whole-deal bulletin, release/history and consumer compatibility; verify realistic mixed-deal flow.
5. Ask Karl about Send Update enhancements and Bloomberg integration as a separate follow-up.