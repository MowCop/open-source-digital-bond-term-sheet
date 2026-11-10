# Origin Markets (Airbrush) templates — reference only

Supplied by Karl M on 10 Nov 2026 (copies of files in his Google Drive "VDR project folder").
Reference material for layout and field coverage. **BDT 2.0 stays authoritative**; nothing here is a second data store.

| File | What it is |
|------|-----------|
| fixed_rate.json / .docx | Airbrush example: fixed-rate note + rendered term sheet |
| floating_rate.json / .docx | Airbrush example: 6m EURIBOR FRN (margin, screen page, fixing centre, determination) |
| zero_coupon.json / zero_coupon_1.docx | Airbrush example: zero coupon (issue price + reoffer yield, no coupon) |
| Machine-Readable_Termsheet_1.docx | Jinja-templated DOCX (`{{trade_date}}`, `{% for issuer in issuers %}` …) |
| Standardised_Termsheet_1.docx | Human-readable standard layout |

## Findings for the multi-tranche DTS
- **Single instrument per file.** Each Airbrush JSON describes one security (`size`, `currency.notional`, one `interest.periods[]`). A multi-tranche deal = one Airbrush document per tranche, matching our one-`IssuanceDataGroup`-per-tranche export.
- **Three rate templates, not two.** Origin ships Fixed, Floating and **Zero coupon**. Add Zero coupon as a third tranche template (no coupon fields; issue price / reoffer yield / accrual quotation).
- **Floating template fields** to cover in our Floating view: floating basis (e.g. 6mEURIBOR), margin, screen rate page/source, fixing financial centre, interest determination manner, fixing reference date, fixing days, term/term period, benchmark, calculation agent.
- **Fixed template fields:** fixed rate, payment frequency, annual payment dates, day count, business day convention/centres, first payment date, stubs.
- **Shared vs per-tranche:** issuers, guarantors, dealers (roles, stabilising/settlement manager), programme, governing law, selling restrictions, clearing, listing are typically shared defaults; identifiers, size, interest, redemption, pricing are per tranche. Identifiers are never copied when duplicating.
- **Missing in Airbrush (pre-pricing):** no IPT, guidance or books fields — consistent with Airbrush covering final terms onwards. These stay as DTS execution extensions.
- ISO code pairs (`type_iso`, `day_count_fraction_iso`, `business_day_convention_iso`) map naturally to BDT enumerations; use them for the BDT → Airbrush mapping from Priced onwards.
- The Jinja DOCX shows how a document generator renders from structured data; we may borrow the layout idea, but render from BDT, not Airbrush, and do not run Python in the app. Check Origin's licence before reusing any template text.
