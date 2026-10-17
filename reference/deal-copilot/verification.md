# VDR Deal Co-Pilot transfer verification

## Verified 17 October 2026
- Signed-in Claude conversation on the saved Al Rajhi deal reads real BDT terms and runs source deterministic checks without changing terms.
- Real extractable PDFs uploaded to an isolated VDR QA deal produce persisted source-quoted document and automatic syndicate reports.
- Human coupon approval changes authoritative BDT and displayed cache atomically; View and Fill show the approved value, including after reload. Human rejection leaves the approved coupon unchanged.
- A subsequent real Fill save starts a completed automatic review against that saved coupon. Original PDFs remain downloadable from the private repository.
- Copied domain tests and isolated PostgreSQL migration tests cover read-only membership, non-member RLS denial, editor-only decisions, stale/double approvals, content and revision deduplication, leases, single-flight, superseded results and audit records.
- Narrow 390px layout has no horizontal page overflow. Desktop and narrow screenshots show the actual open panel. Preview had no runtime errors and current build passed; conventional/DLT verification remains unchanged.

## Boundaries
- Membership denial and read-only approvals were tested against the actual migration SQL in isolated PostgreSQL, not by signing into other people's live accounts.
- Source historical conversations and records were not imported: the source snapshot contains code only. Import requires an exported dataset with VDR deal mapping.
- Co-Pilot is event-driven, not a background schedule. Failed/paused work requires explicit resumption. Copied reader limits remain 10 MB, 50 PDF pages, 60,000 readable characters.
- Programme ceilings are not tranche sizes; the first live Supplement review exposed this risk and an additional evidence guard was added and tested. No Al Rajhi terms were changed.