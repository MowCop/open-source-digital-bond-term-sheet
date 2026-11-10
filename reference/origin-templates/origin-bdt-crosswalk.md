# Origin template labels vs ICMA BDT 2.0 — crosswalk (fixed and floating rate)

No building yet. This is the cross-check you asked for, followed by the decisions needed before the build.

## Already agreed
- Shared fields are copied from Tranche A when a tranche is added (bookrunners come from the document drop / New Deal as today). The banker can change them per tranche.
- The panel expands inline under its row (double-click the row or the expand button on the far right). The panel also has a button to open it as a full pop-up. Esc closes it.
- Tranche type = rate type (Fixed / Floating, Zero coupon later) + seniority (Senior Unsecured, Senior Preferred / Non-Preferred, Subordinated / Tier 2, AT1, Covered).

## Cross-check: Origin label -> BDT 2.0 field (and scope)

Scope: **D** = deal-wide (same for every tranche, synced with All fields), **C** = copied from Tranche A but editable, **T** = unique to the tranche.

| Origin label | BDT 2.0 field (DTS label) | Scope | Match |
|---|---|---|---|
| Term Sheet dated | Document date | D | Exact |
| Issuer(s) + LEI | Parties: ISSUER (LEI) | D | Exact |
| Issuer Rating | Expected issue ratings (issuer) | D | Partial: BDT holds issue ratings; issuer rating sits on the party |
| Guarantor + LEI | Parties: GUARANTOR / Guarantee type | D | Exact |
| Guarantor Rating | Party ratings | D | Partial (as above) |
| EMTN (programme) | Programme identifier / description | D | Exact |
| Currency | Specified currency | C | Exact |
| Series Number | Series / SeriesIdentifier | T | **In the BDT schema but not yet in the 197-field list** |
| Issuance Type | Issuance type | C | Exact |
| Form of the Notes ("Reg S Bearer") | Initial physical form + Regulation S category | C | Split: Origin combines two BDT fields |
| ECB Eligible | Intended to be held in a manner allowing Eurosystem eligibility | C | Exact (label differs) |
| Status of the Notes | Seniority + Subordination + Security + Preference | T (set by tranche type) | Split: one Origin label = four BDT fields |
| Nominal Amount | Aggregate nominal amount (+ currency) | T | Exact |
| Specified Denominations | Specified denomination | C | Exact |
| Trade Date | Pricing date | C | Label differs (BDT has no "trade date") |
| Settlement Date | Settlement date / Issue date | C | Exact |
| Maturity Date | Maturity date | T | Exact |
| Interest Payment Date(s) | Coupon frequency + payable day/month | T | Split |
| First Interest Payment Date | First coupon date | T | Exact |
| Rate of Interest (fixed) | Coupon (fixed rate) | T | Exact |
| Rate of Interest (floating: "6m EURIBOR + 34bp") | FloatingRatePayment: ReferenceRate + Margin | T | **In the BDT schema but missing from the 197-field list** |
| Interest Determination Date(s) (floating) | FloatingRatePayment: DeterminationDates / DeterminationMethod | T | **Missing from the 197-field list** |
| Calculation Agent (floating) | Parties: CALCULATION_AGENT | D | Exact |
| Issue Price | Issue price | T | Exact |
| Net Proceeds | Net proceeds | T | Exact |
| Redemption Price | Final redemption percentage | T | Label differs |
| Day Count Fraction | Day count fraction | T | Exact |
| Business Day Convention | Business day convention | C | Exact |
| Business Days | Business day centres | C | Exact |
| Use of Proceeds | Use of proceeds (+ description) | C | Exact |
| Product Governance/Target Market | Manufacturer target market | D | Exact |
| Sole Manager | Parties: LEAD_MANAGER / JOINT_BOOKRUNNER | C | Exact (role chosen) |
| Issuing Agent | Parties: ISSUE_AGENT / FISCAL_AGENT | D | Exact |
| ISIN / Common Code | Security identifiers | T | Exact (always per tranche) |
| Clearing System(s) | Clearing system | D | Exact |
| Documentation | Deal documents | D | Exact |
| Governing Law | Governing law | D | Exact |
| Listing | Listed + Listing venue | D | Exact |
| Selling Restrictions | Country / additional selling restrictions | D | Exact |
| TEFRA Category | TEFRA | C | Exact |

### Findings
1. 34 of 39 Origin labels map directly to existing DTS fields.
2. 5 labels combine or split BDT fields (Form of the Notes, Status of the Notes, Interest Payment Dates, Trade Date, Redemption Price). The panel will show Origin's single label but save into the correct BDT fields.
3. **Gap:** the floating-rate terms (reference rate, margin, determination dates, reset) and Series number exist in the official BDT 2.0 schema but are not yet in the DTS's 197-field list. Today the floating panel would have nowhere to save "6m EURIBOR + 34bp". These must be added (from the official schema, not invented) before the floating panel can work.
4. Fields not in Origin but needed for execution (IPT, guidance, spread to mid-swaps/benchmark, reoffer yield, books) are per-tranche execution fields and would also appear in the panel.

## Decisions needed (please answer before build)
1. **Add the missing floating-rate BDT fields** (reference rate, margin, determination dates/method, reset, Series number) to the master list? This takes it above 197 fields.
2. **Labels:** show Origin's wording (e.g. "Rate of Interest", "Status of the Notes") with the BDT name as a small hint, or show BDT wording?
3. **Execution fields** (IPT, guidance, spread, reoffer yield): include in each tranche panel, or keep in All fields only?
4. **Scopes:** are the D / C / T assignments in the table right? In particular Currency, Issuance Type and Settlement Date as "copied from Tranche A".

## After approval (outline)
- Per-tranche term storage inside the deal workspace; deal-wide fields stay in the main term sheet so All fields and tranche panels stay in sync both ways.
- Field set chosen from the BDT dictionary by rate type + seniority; Origin labels as display overrides only (one definition per field).
- Inline expandable panel with pop-up option and Esc to close; replaces the "open full terms in All fields" action.
- Tests for field selection per tranche type and deal-wide sync.
