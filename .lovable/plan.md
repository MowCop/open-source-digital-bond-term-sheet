## Deliverable

A single 2-page PDF — `New_Issue_Vault_Overview.pdf` — saved to `/mnt/documents/` and delivered as a downloadable artifact.

## Audience & tone

Balanced overview — readable by execs/investors, credible to DCM/syndicate readers. ICMA / MiFID II / MAR terminology used where it adds weight, but no jargon walls.

## Structure (2 pages)

**Page 1 — What it is & why it exists**
- Title block: "New Issue Vault — AI-native primary bond market infrastructure"
- One-paragraph positioning statement (the "competitive position in one sentence" reframed).
- "The problem with the status quo" — condensed: Outlook irreversibility, Bloomberg cost, taxonomy fragmentation, manual re-keying across vendors.
- "What the New Issue Vault is" — bank-hosted VDR + native New Issue Alert Thread; banks drop content, everything downstream is automated.

**Page 2 — Three AI pillars + commercials & compliance**
- **AI as Parser** — extracts ICMA-taxonomy structured data from term sheets, alerts, and free-text chat ("size up to EUR 750m" parsed as a field update). Once at source, not ten times across vendors.
- **AI as Compliance Checker** — version diffing with HITL controls, full audit trail of every upload/extraction/push, permissioned disclosure, alignment with MiFID II / MAR and emerging primary-market transparency rules.
- **AI as Feed Automator (Bond Consol)** — single clean structured feed pushed simultaneously to all subscribed vendors via API / MCP; Bond Consol acts as the consolidated outbound channel, eliminating vendor-by-vendor rekeying.
- Short closing strip: pay-per-deal / AI-metered pricing, bank-hosted & bank-controlled, ICMA built-in.

## Design

- Clean editorial 2-pager, A4 portrait, ~18mm margins.
- Restrained palette anchored on deep navy + warm gold accent (Navy Trust / Emerald Prestige tone — fits finance/legal audience).
- Serif display headings (e.g. Libre Baskerville / DM Serif) paired with a clean sans body (IBM Plex Sans / Inter) for editorial credibility.
- Two-column body on page 2 for the three AI pillars; iconographic bullets, no clip-art.
- Footer: "New Issue Vault · Confidential draft · June 2026".

## Build approach (technical)

- Generate via Python using ReportLab Platypus (SimpleDocTemplate, Paragraph, Table, Spacer) — reliable for typographic 2-pagers.
- Write script to `/tmp/`, output PDF to `/mnt/documents/New_Issue_Vault_Overview.pdf`.
- QA: render both pages to JPG with `pdftoppm` and visually inspect for overflow, overlap, orphaned headings, and that content fits exactly 2 pages. Iterate until clean.
- Deliver via `<presentation-artifact>` tag.

## Out of scope

- No changes to the app codebase.
- No DOCX version (PDF only, per your choice). Easy to add later if needed.
