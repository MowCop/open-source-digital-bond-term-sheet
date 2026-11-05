# Digital Deal Room (DDR)

Digital Deal Room is for professionals involved in the execution of new bond issues. It provides digital synchronisation of deal terms via  Digital Term Sheets with internal and external stakeholders, augmented with the option to use AI.

## Definitions — The Digital Term Sheet

The Digital Term Sheet (DTS) is what evolves during bond syndication. It is the ultimate source of truth and where a bond's formal life begins.

- A bond's schema, data fields and legal framework are collectively called the "terms", and these are reproduced onto a digital term sheet (DTS).
  
-  The DTS can be viewed several ways:
   i)   Standard text (default Bloomberg alett friendly)
   ii)  Digitally - XML (API/MCP friendly)
   iii) DLT (blockchain friendly)
   iv) Physical file (eg PDF)
-   Lawyers, Issuer Council and Bank Syndicates / DCM are the main players in providing information to build the TS.

## What the DTS does
- Adds information to the deal in real time during syndication.
- Builds and sends deal update blasts to external email recipients — including Bloomberg recipients.
- Connects with external APIs / MCPs to feed real-time data as deals progress.
- Additional '* AI Deal Checker' layer that checks and verifies updates to the terms.

## Digital Term Sheet workflow

- Select * Create New Deal > *Related documents can be dropped into the DTS at the start (and at any time) during the life of the DTS  > Save  data self-populates into the DTS essential fields >  the DTS is live and ready for execution / publication > Bloomberg/Email message blast created from the existing DTS data > integrated incoming messages ingest field updates from external sources (Bloomberg/Outlook)
  
 * RELATED DOCUMENTS = Prelimiary Offering Circulars, Memorandums, Addemdums, Other Term Sheet documentation, Emails+Attachements, forwarded Bloomberg chats.messages.
  
  Create New Deal button can build a draft DTS manually if no ducumentation is available. 

- During syndication the DTS interface can be updated manually or parsed through feedback loop messaging integrated with Bloomberg/Outlook incoming alerts, partially or fully, using AI 

## Deal blasts and chat

- If there is no initial deal blast message, the AI can create or suggest one.

* AI Deal Checker

The AI Deal Checker runs in the background, applying compliance rules and bond semantics to ensure accuracy across all parts of the VDR.

 USPs

- Standards of ICMA BDT (2.0) universally applied, standardising schema 
- Maximum compliance and security
- The DDR can be used to help legal and syndicate / DCM teams build the TS in one place
- Internal digital deal data syncs seemlessly with APIs/MCPs maximising interoperbility

## Workflow at a glance

 RELATED DOCUMENTS                No DOCUMENTS
  Dropped...                        Typed ...
 AI self-populates                ...'Issuer Name' 
       (creates DTS)              (creates DTS)
             \                         /
              \                       /
               v                     v
            ┌──────────────────────────────┐
            │   Digital Term Sheet         │
            │   (source of truth)          |
            |   Staged Execution           │
            └──────────────┬───────────────┘
                           │  
        ((( updated manually or by AI parse )))
                           v
            ┌──────────────────────────────┐
            │  Syndication:                │
            │  message + doc updates       │          
            │  parse back to generate      |
            |  next evolutionary stage of  |
            |  DTS, then AI regenerates    │
            │  new later stage blasts      │
            └──────────────┬───────────────┘
                           │
                           v
            ((  External API / MCP feeds   ))
              (( updated at every stage ))            
         
                           
           

             
```

## Contributing

Contributions are welcome from participating banks, syndicate/DCM and legal professionals, and developers. See [CONTRIBUTING.md](CONTRIBUTING.md) for the community rules — including adherence to ICMA BDT 2.0 as the underlying schema standard, how to submit pull requests against `main`, code style, and responsible vulnerability disclosure.

## Headless Taxonomy Engine / Shared Library (SDK / Microservice)

The **Headless Taxonomy Engine / Shared Library** — the ICMA BDT 2.0 schema engine behind the VDR, available as an SDK or a standalone microservice for use in your own systems — is **available on request**. It is not part of this open-source repository. To request access or discuss licensing, contact the team via [www.eurobondmarkets.com](https://www.eurobondmarkets.com).

## Licence

Apache License, Version 2.0 — see [LICENSE](LICENSE).
