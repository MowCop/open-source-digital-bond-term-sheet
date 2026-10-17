# VDR Deal Co-Pilot transfer verification

## Verified 17 October 2026
- Additional walkthrough retained as “Co-Pilot Walkthrough — 17 Oct 2026”: uploaded a clearly labelled test PDF, reviewed through Claude, approved coupon 4 → 4.25, and confirmed saved approval, original PDF and coupon in both View and Fill after reload. Fixed explicit “4.25% per annum” normalization, with a regression test.
- Live database rollback test using an existing read-only identity verified outsider RLS denial, member report/approval visibility and server denial of approval. Temporary membership was rolled back and confirmed absent; no user roles were changed.
- Signed-in Claude conversation on the saved Al Rajhi deal reads real BDT terms and runs source deterministic checks without changing terms.
- Real extractable PDFs uploaded to an isolated VDR QA deal produce persisted source-quoted document and automatic syndicate reports.
- Human coupon approval changes authoritative BDT and displayed cache atomically; View and Fill show the approved value, including after reload. Human rejection leaves the approved coupon unchanged.
- A subsequent real Fill save starts a completed automatic review against that saved coupon. Original PDFs remain downloadable from the private repository.
- Copied domain tests and isolated PostgreSQL migration tests cover read-only membership, non-member RLS denial, editor-only decisions, stale/double approvals, content and revision deduplication, leases, single-flight, superseded results and audit records.
- Narrow 390px layout has no horizontal page overflow. Desktop and narrow screenshots show the actual open panel. Preview had no runtime errors and current build passed; conventional/DLT verification remains unchanged.

## Boundaries
- Membership and approval rules were tested in isolated PostgreSQL and against live policies in a rollback transaction, not by signing into other people's browser accounts.
- Source historical conversations and records were not imported: the source snapshot contains code only. Import requires an exported dataset with VDR deal mapping.
- Co-Pilot is event-driven, not a background schedule. Failed/paused work requires explicit resumption. Copied reader limits remain 10 MB, 50 PDF pages, 60,000 readable characters.
- Programme ceilings are not tranche sizes; the first live Supplement review exposed this risk and an additional evidence guard was added and tested. No Al Rajhi terms were changed.
## Specialist transfer (2026-10-17)

The four workshop specialists (Compliance & Regulatory, Pricing & Benchmark, ESG & Sustainable Finance, Syndicate Communications) were ported from the "Your AI Agent Creator" workshop into the VDR deal-copilot function: domain/specialists.ts (schema, evidence-quote filtering, ACT/360-ACT/365F accrual, T+1/T+2 settlement, escaped unvalidated XML draft) and specialists.ts (gateway runner with a bounded pricing tool loop). Chat gained five delegation tools (reviewCompliance, reviewPricing, reviewEsg, draftCommunications, reviewSpecialists); automatic saved-term and document-completion reviews now run one leased coordinator pass followed by the four specialists sequentially, saved atomically as report JSON version 2 — no new tables, no copied workshop conversations or documents. Communications drafts remain unsent; the XML draft is explicitly not BDT-validated. No live sanctions/LEI, benchmark, legal or distribution claims. Seven specialist safeguard tests plus the full 103-test suite, verify.mjs and verify-dlt.mjs pass.
