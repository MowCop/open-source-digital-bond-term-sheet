# NewIssueVault — Digital Deal Room (VDR)

NewIssueVault is an open-source Digital Deal Room for new bond issues. Its mission is to give bond syndication and execution teams a single, standards-based system of record — so a new issue reaches pricing with term-sheet data that every participant can trust: syndicate, DCM, legal, investors and recipients alike.

It provides digital synchronisation of the Digital Term Sheet with internal and external stakeholders, augmented with the option to use AI.

**Hosted portal:** the managed deployment lives at [www.eurobondmarkets.com](https://www.eurobondmarkets.com). This repository contains the source; you may self-host it under the Apache 2.0 licence, or use the hosted portal.

## Definitions — The Digital Term Sheet

The Digital Term Sheet (TS) is what evolves during bond syndication. It is the ultimate source of truth and where a bond's formal life begins.

- A bond's schema, data fields and legal framework are collectively called the "terms", and these are produced on a digital term sheet (TS).
- The TS can be a physical document (e.g. PDF) or a digital file (e.g. XML).
- Lawyers and Bank Syndicates / DCM are the main players in providing information to build the TS.

## What the VDR does

- Adds information (terms) to the TS in real time during syndication.
- Builds and sends deal update blasts to external email recipients — including Bloomberg recipients.
- Connects with external APIs / MCPs to feed real-time data as deals progress.

## Digital Term Sheet options

- The TS can be dropped into the VDR at the start of the process — the VDR self-populates the terms.
- If no TS is available, one can be built from scratch in the VDR (create deal).
- During syndication the TS document can be updated manually or parsed, partially or fully, using AI.

## Deal blasts and chat

- The AI parser option can be applied from the deal chat.
- The AI parser can be applied from the deal message blast.
- If there is no deal blast message, the AI can create or suggest one.

## AI Deal Checker

The AI Deal Checker runs in the background, applying compliance rules and bond semantics to ensure accuracy across all parts of the VDR.

## ICMA BDT-compliant data structures

All deal data in NewIssueVault conforms to the **ICMA Bond Data Taxonomy (BDT 2.0)** — the market's standard schema for bond issuance data. In practice this means:

- **One field dictionary.** Every term-sheet field (issuer, guarantor, identifiers, parties and roles, ratings, coupon, tenor, settlement mechanics, documentation and more) is defined once in a single dictionary, selected by path — never duplicated.
- **Structured parties and ratings.** Counterparties are modelled as BDT Party structures with role assignments (bookrunner, global coordinator, legal advisor, etc.) and per-agency PartyRating entries, mirroring the taxonomy's structured tables.
- **Lifecycle stages.** Deals move through the BDT-aligned lifecycle (mandate, announcement, pricing, settlement — displayed as "Settled") with stage snapshots retained.
- **Machine-readable in, machine-readable out.** BDT/XML term sheets can be dropped in and are mapped field-by-field into the app; recorded terms project back out in the taxonomy's structure for interchange with other systems.
- **Validation built on the schema.** Compliance and bond-semantics checks (including identifier checks for LEI and FIGI) run against the taxonomy-mapped fields, so a checked term sheet is a conformant term sheet.

## Workflow at a glance

```text
  Digital Term Sheet dropped in            No digital term sheet
  (VDR self-populates)             (create deal in VDR)
             \                         /
              \                       /
               v                     v
             ┌──────────────────────────────┐
            │   Digital Term Sheet in the VDR      │
            │   (source of truth)          │
            └──────────────┬───────────────┘
                           │  updated manually or by AI parse
                           v
            ┌──────────────────────────────┐
            │  Syndication: deal chat +    │
            │  deal update blasts          │
            │  (AI parse from either;      │
            │   AI can draft a blast)      │
            └──────────────┬───────────────┘
                           │
                           v
            ┌──────────────────────────────┐
            │  AI Deal Checker             │
            │  compliance + bond semantics │
            └──────────────┬───────────────┘
                           │
                           v
       Email blasts (incl. Bloomberg)  ·  External API / MCP feeds
```

## Contributing

Contributions are welcome from participating banks, syndicate/DCM and legal professionals, and developers. See [CONTRIBUTING.md](CONTRIBUTING.md) for the community rules — including adherence to ICMA BDT 2.0 as the underlying schema standard, how to submit pull requests against `main`, code style, and responsible vulnerability disclosure.

## Headless Taxonomy Engine / Shared Library (SDK / Microservice)

The **Headless Taxonomy Engine / Shared Library** — the ICMA BDT 2.0 schema engine behind the VDR, available as an SDK or a standalone microservice for use in your own systems — is **available on request**. It is not part of this open-source repository. To request access or discuss licensing, contact the team via [www.eurobondmarkets.com](https://www.eurobondmarkets.com).

## Licence

Apache License, Version 2.0 — see [LICENSE](LICENSE).
