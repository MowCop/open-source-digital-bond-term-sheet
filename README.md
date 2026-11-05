# Digital Deal Room (DDR)

Digital Deal Room is for professionals involved in the execution of new bond issues. It provides digital synchronisation of deal terms via  Digital Term Sheets with internal and external stakeholders, augmented with the option to use AI.

## Definitions — The Digital Term Sheet

The Digital Term Sheet (DTS) is what evolves during bond syndication. It is the ultimate source of truth and where a bond's formal life begins.

- A bond's schema, data fields and legal framework are collectively called the "terms", and these are reproduced on a digital term sheet (DTS).
  
-  The DTS can be viewed several ways:
   i) Standard text (default Bloomberg alett friendly)
   ii) Digitally - XML (API/MCP friendly)
   iii) DLT (blockchain friendly)
   iv) Physicsl file (eg PDF)
-   Lawyers, Issuer Council and Bank Syndicates / DCM are the main players in providing information to build the TS.

## Whatthe VDR does
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

## USPs

- Standards of ICMA BDT (2.0) universally applied, standardising schema.
- Maximum compliance and security.
- The VDR can be used to help legal and syndicate / DCM teams build the TS.
- Internal digital deal data syncs automatically with the TS.

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
