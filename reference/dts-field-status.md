# DTS field certainty workflow

## Workflow
Create New Deal is the primary entry point: Document → Review → Template → DTS. PDF/DOCX extraction uses the existing service; each proposed value is editable next to an exact matching source excerpt where available. Missing excerpts are explicitly disclosed; nothing is accepted automatically. Manual entry remains available. GLEIF candidates are selected by a person. Creation still requires issuer and an explicitly named bookrunner.

Fixed, Floating and Zero coupon select the BDT field subset via the existing Origin-to-BDT crosswalk. Origin JSON examples are never populated into real deals. BDT labels and scopes remain authoritative. Fixed/FRN/zero selection uses the document and extracted interest type, with a manual template choice. A document containing multiple alternatives must be reviewed; the selected initial template is not an automatic multi-tranche structure extraction.

## Field metadata
`bdt_state.fieldMeta[path]` records `status`, `source`, `by` (authenticated user ID), `at`, optional `suggestion` / `why`, `latest`, and prior values. Tranche-specific keys use `tranche:<id>:<path>` and are projected into each tranche's BDT view. Repeating groups have per-cell metadata plus a group attribution fallback for older records.

- Set: recorded / confirmed terms, green lock. Changing a Set field asks for confirmation; saves are audited.
- Expected: blue suggested value with a reason, outside authoritative `f`. Confirm applies the value and marks it Set. Suggestions are never automatically saved as facts or exported. Initial conventions cover EUR fixed ICMA Actual/Actual, EUR/USD FRN ACT/360 and Modified Following; a wholesale EUR denomination suggestion requires an already recorded institutional target market. These are market conventions with Handbook A5/A8/C1 references, not mandated Handbook defaults.
- Open: missing or evolving execution terms, amber marker, with usual fixing stage. Human-updated IPT/guidance/books stay Open with Latest and value history; final pricing fields become Set after approval.

Handbook May 2026 takes precedence. Listing, legal legends, clearing elections, target markets and stabilisation are not fabricated from currency alone; deal documentation and applicable law prevail. This implementation intentionally does not auto-suggest those legal elections or a €1,000 increment without sufficient saved evidence.

All fields retains normal BDT sections, status markers and filters. Tranche panels and switchers show certainty counts. Before IPTs the editor remains central with document intake left and Co-Pilot drawer; during execution Co-Pilot remains central, Open-first tranche summary left and Live MSG right. Settled stays read-only. No actor checklist, waiting strip, override badge or readiness gate remains. Syndicate administrators change stages using the existing lifecycle controls.

## Approval and distribution
Existing propose → human approve → atomic save is retained, including stale snapshot checks, permissions and audit. The database save trigger attributes approved commands to their request and approver; interim updates remain Open/Latest. Saved values refresh Live MSG through the existing subscriptions and local event. Expected/unsupported Open values are excluded from generated message rows, fallback HTML and XML attachments. User-written free-text notes remain separately human-reviewed; the formatter cannot safely infer or censor their meaning.

Pricing completeness runs from the BDT Priced stage (5) for metadata-enabled terms, against the selected template's full tranche field subset; unresolved Open/Expected fields produce Deal Checker failures. No execution gate prevents lifecycle progression. Existing legacy values are preserved and displayed as Previously recorded DTS, not retroactively claimed to have a known confirmation user/date.

## Roles
Team membership and all existing DCM/legal/counsel edit guards remain. DCM changes structure and bookrunners only; assigned legal/counsel edit during documentation and remain read-only during execution. No additional sign-off authority exists. Manual phase view switching is presentation-only.

## Migrations
- `0017_retire_signoff_gate.sql`: removes reopen/audit/identity/gate triggers, transition routines and shared checklist definitions; removes actor-context sign-off counts. Retires `deal_signoffs` and revokes writes. Deals, terms, team members and historical audit records are untouched.
- `0018_dts_field_status_audit.sql`: authenticated save attribution, field/tranche history/audits, command-source propagation inside the existing approval transaction, and DCM metadata guard.
- `0019_complete_signoff_retirement.sql`: removes the remaining text legal-notice helper, adds per-cell party/identifier/document metadata audits.

Physical `DROP TABLE deal_signoffs` was rejected by the current backward-incompatible migration permission. The unused table is intentionally retained, deprecated, and write-disabled. To permit physical removal, change Settings → Agent permissions → Execute backward incompatible database migrations to Ask each time or Always allow, then request the final removal. Acceptance applies recorded structure changes to the app; this draft's own example data never moves to it.

## Verification
See the tests in `src/test/fieldStatus.test.ts` and `src/test/dealActors.database.test.ts`: three template types, Expected→Set, approved command→Set, interim history, MSG exclusion, per-tranche metadata, pricing completeness, retirement preserving all deal rows, direct administrator stage progression, document changes without sign-off reopening, and retained DCM guards. Historical sign-off tests remain isolated regression coverage for earlier migrations only.

## Evolving execution variables (addendum)
- Open with history until pricing: IPTs, guidance, price talk (`x:priceTalk`), yield talk (`x:yieldTalk`), deal size wording (`x:sizeMsg`: Benchmark, Benchmark (USD 500m+), Target USD 1bn, Expected / WNG), per-tranche size indication (`x:sizeIndication`) and deal size skew (`x:sizeSkew`). Every save keeps the prior value, source, who and when; the deal page shows the evolution as a mini timeline.
- Talk text is stored verbatim; `parseTalk` (src/lib/execution) derives a numeric range (area, ranges, +/-, bp, WPIR). Final values (issue price, re-offer yield, coupon, sizes) are separate numeric BDT fields.
- Spread convention defaults from currency (USD vs UST, others vs MS) and can be overridden (`x:spreadConvention`).
- Multi-currency deals: headline is the USD-equivalent total (`x:usdEquivalent`, else computed from recorded FX) with per-currency totals and FX source/time.
- Co-Pilot understands "Size the 10s at 1bn, 30s at 750m", "Skew to the long end", "Deal size 2.5bn USD equivalent", "Deal size benchmark WNG", and "IPTs / Guidance / Price talk / Yield talk tranche B …" — all still preview → human Execute.
- At Priced the Deal Checker fails until each tranche's final size, issue price, re-offer yield and (fixed) coupon, the total size and (multi-currency) USD-equivalent total are Set.

## Tranche term → dates, and quiet checks for evolving fields (addendum 2)
- Tenor text per tranche (3Y…30Y, "long 10Y", "PNC5", "5.5Y") is Open with history. Once a settlement/issue date exists, maturity is suggested as Expected = settlement + tenor, rolled Modified Following on the currency calendar (TARGET2 EUR, US for USD, London for GBP; ICMA Rule 251.2). Confirm → Set. Perpetuals (PNC) get no suggestion.
- MSG shows TENOR until maturity is Set, then `MATURITY : 15-JAN-2037 (10Y)`.
- Deal Checker: empty evolving fields (maturity, coupon, sizes, price/yield, spreads, dates, ISIN) are never issues before Priced; the required-fields line shows "N Open — expected at pricing" as a pass. At Priced the completeness check flags them.
- When dates exist: maturity, settlement, issue, pricing and first coupon dates must be business days (rule-based calendars, any year); settlement after pricing; maturity after settlement; maturity within 5 days of settlement + tenor.
