# Deal Checker capabilities (living reference)

Keep this document in step with the Deal Checker. Any change to its checks, fixes or knowledge sources must update this file in the same change.

Code map: `src/lib/bdt-bridge.ts` (unifiedChecks), `src/lib/termsheet/validate.js` (vendored, read-only), `src/lib/bondValidator.ts`, `src/lib/gleif.ts`, `src/lib/openfigi.ts`, `src/lib/conventionChecks.ts`, `src/lib/checkActions.ts`, `src/components/termsheet/UnifiedDealChecker.tsx`.

## Overview

The Deal Checker acts as an automated bond compliance and syndicate validation desk. It is a **single unified validation surface** (`unifiedChecks`) that evaluates term sheet state in real time across four levels:

1. **Deterministic bond math and ICMA taxonomy rules** (instant offline validation)
2. **Market conventions, settlement rules, and multi-currency holiday calendars**
3. **Live institutional registry verification** (GLEIF for LEIs, OpenFIGI for securities)
4. **AI document extraction and automated repair** ("Try to Fix" and auto-suggest driven by dropped prospectuses and term sheets)

Checks update live as terms are typed, stages advance, or documents are uploaded, and can be clicked to jump directly to any flagged field.

## What checks it can do

### 1. ICMA BDT & stage readiness rules
- **Stage-by-stage completeness:** required fields validated as deals advance (Announced → IPT → Books Open → Books Closed → Priced → Allocated → Settled).
- **Party roles & syndicate composition:** Issuer must be named; syndicated distribution needs at least two named managers/bookrunners; flags missing listing agents or stabilisation managers when applicable.
- **Identifier check digits:** ISIN (Luhn), Common Codes, offline LEI (ISO 7064 MOD 97-10).
- **Date chronology:** Pricing Date ≤ Issue Date ≤ Settlement Date < Maturity Date; flags divergence between final redemption and maturity.
- **Selling restrictions & target markets:** global note format vs US TEFRA (TEFRA D with temporary global notes; TEFRA C with permanent global notes); wholesale/ECP target markets vs retail prohibition legends (PRIIPs `NO_EEA` / `NO_UK`); UK Consumer Composite Investments (CCI) determinations.
- **Pricing & math consistency:** directional discrepancies among coupon, price and yield (discount pricing must yield above coupon); total aggregate equals product aggregate; minimum denomination multiples.

### 2. Market conventions, calendars & benchmarks
- **Holiday calendars:** pricing, issue, settlement, maturity and coupon dates against TARGET2 (EUR), London (GBP) and US Federal/SIFMA (USD) through 2027.
- **Settlement cycles:** non-standard horizons, US SEC T+1 and Eurobond T+2.
- **Benchmark & currency pairing:** EUR vs Bund/DBR/OBL/Bobl; USD vs US Treasuries; GBP vs Gilts; CHF vs Eidgenossen; JPY vs JGBs; governing law compatibility.

### 2a. Floating-rate conventions (when Interest type is FLOATING)
- **Day count vs currency:** ACT/360 for EUR, USD, CHF; ACT/365F for GBP, CAD, AUD; ACT/360 or ACT/365F for JPY (warning otherwise).
- **Business days:** Modified Following expected; unadjusted interest periods flagged.
- **Coupon frequency:** annual, biannual or at-maturity payment flagged as unusual.
- **ISDA definitions:** missing → warning; 2006 → warning (2021 carries the risk-free-rate fallbacks); 2021 → pass.
- **Floor/cap:** floor above cap → fail; no floor → warning (zero floor is standard).
- **Fixed coupon on an FRN:** warning.
- Limitation: BDT 2.0 in this template has no reference-rate or margin field, so SOFR/€STR/SONIA pairing is not yet checked.

### 2b. ESG disclosure (ICMA Green/Social/Sustainability Bond and SLB Principles)
- **Framework cited:** labelled bonds without a document named "framework" in the Documentation list → warning.
- **External review:** no second party opinion / external review / verification cited → warning.
- **Sustainability-linked:** no coupon step-up margin → fail.
- **Use-of-proceeds (green, social, sustainability):** no allocation/impact reporting document cited → warning.
- **Unlabelled:** green/social/sustainability documents cited but no ESG label → warning.

### 3. Live entity & security registry checks (hybrid)
- **GLEIF LEI registry:** valid LEIs checked live for active status and legal-name match.
- **Unidentified entity matching:** name without LEI → live GLEIF search with ranked suggestions (never auto-applied).
- **OpenFIGI mapping:** ISIN → FIGI, Share Class FIGI, Composite FIGI (suggestions never auto-applied).
- **Regulatory reporting:** warns when reporting pairs are incomplete (ESMA MiFIR/EMIR/SFTR: ISIN + issuer LEI; FINRA TRACE: CUSIP/FIGI for USD deals).

### 4. Document repository alignment & "Try to Fix"
- **Vault document verification:** documents stored in the deal's Documents tab turn "No deal documents attached" green.
- **Auto-fix actions:** "Try to Fix" (warnings and fails) fills currency, benchmark, tenor, bookrunners, common code, FIGI, GLEIF legal name or saved documents from the last dropped file or registry data. Fixes edit only the unsaved Fill state; the user still presses Save. Warnings can be ignored per deal (per browser).

## Knowledge base

| Knowledge layer | Sources | Role |
| :--- | :--- | :--- |
| ICMA Bond Data Taxonomy (BDT v2.0) | `schema/icma-bond-data-taxonomy.xsd`, enums and type-restriction schemas | Data dictionary, required fields by stage, XML schema validation. |
| ICMA Primary Market Handbook | Appendix A8 pro formas (`reference/ICMA-Primary-Market-Handbook-Appendix-A8-260918.pdf` + `.txt`) | Final terms fields, selling restrictions, document citation conventions (Sept 2018; flag conflicts with EU Prospectus Regulation). |
| ICMA Sustainable Finance Principles | Green Bond, Social Bond, Sustainability Bond Guidelines and Sustainability-Linked Bond Principles | ESG framework, external review, reporting and SLB step-up disclosure rules. |
| ISDA Definitions & money-market conventions | 2006/2021 ISDA Definitions; currency day-count conventions | Floating-rate determination, fallbacks and accrual conventions. |
| GLEIF Global Registry | `api.gleif.org` via the gleif-lookup function | Live source of truth for LEIs, legal names, registration status. |
| OpenFIGI & global reporting | `api.openfigi.com` + ESMA RTS 23 / MiFIR / EMIR / SFTR, FINRA TRACE | Security identifiers and cross-border reporting requirements. |
| Central bank & ICSD calendars | TARGET2 (ECB), London (BoE), US Federal Reserve schedules through 2027 | Business-day settlement and coupon date integrity. |
| Deal-specific vault documents | Offering circulars, term sheets, prospectuses, supplements in the deal repository | Parsed by Claude models to suggest terms, propose citations and feed "Try to Fix". |
