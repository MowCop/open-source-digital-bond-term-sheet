# Digital Deal Room workflow documentation in the README

Replace the placeholder `README.md` at the project root with a structured write-up of the Digital Deal Room (VDR) workflow, based on the definitions you supplied.

## Document structure

1. **Overview** — what the VDR is: digital synchronisation of the bond Term Sheet with internal and external stakeholders, augmented with AI.
2. **Definitions — The Term Sheet**
   - The TS evolves during bond syndication and is the ultimate source of truth; a bond's formal life begins there.
   - Schema, data fields and legal framework are collectively the "terms", carried on a term sheet (TS).
   - The TS may be a physical document (PDF) or a digital file (XML).
   - Lawyers and Bank Syndicates / DCM are the main contributors of TS information.
3. **What the VDR does**
   - Adds terms to the TS in real time during syndication.
   - Builds and sends deal update blasts to external email recipients (including Bloomberg).
   - Connects to external APIs / MCPs to feed real-time data as deals progress.
4. **Term sheet entry options**
   - Drop an existing TS into the VDR at the start — the VDR self-populates the terms.
   - No TS available: build one from scratch in the VDR (create deal).
   - During syndication the TS can be updated manually or parsed, partially or fully, by AI.
5. **Deal blasts and chat**
   - AI parser can run from the deal chat.
   - AI parser can run from the deal message blast.
   - Where no blast message exists, AI can create or suggest one.
6. **AI Deal Checker** — runs in the background, applying compliance rules and bond semantics to keep every part of the VDR accurate.
7. **USPs**
   - ICMA BDT (2.0) standards applied universally, standardising schema.
   - Maximum compliance and security.
   - Supports legal and syndicate/DCM teams in building the TS.
   - Internal digital deal data syncs automatically with the TS.
8. **Workflow at a glance** — a short ASCII diagram running Term sheet in / create deal → syndication updates (manual or AI parse) → deal chat and blasts → AI Deal Checker → API/MCP distribution.

## Notes

- Wording stays faithful to your text; only light editing for grammar and consistent terminology.
- Nothing is invented — no metrics, client names or claims beyond what you provided.
- No application code or behaviour changes; this is a documentation-only edit to `README.md`.
