# Upgrade the Digital Term Sheet with a "Fill" view

## Goal
Bring the Fill part of Claude's Draft 3 term sheet into the existing Digital Term Sheet page. It should look like the rest of the Virtual Deal Room (same dark panels, fonts, badges, orange/green accents), not like Claude's layout. The fields a syndicate desk uses most during execution come first. Everything else stays one click away.

## What you will see on each deal
Each expanded deal gets two tabs: **View** (today's read-only layout, unchanged) and **Fill** (new, for editing).

The Fill tab has three layers:

```text
+--------------------------------------------------------------+
| Stage rail: Mandate > Announced > IPT > Guidance > Launch >   |
|             Priced > Settled      (current stage highlighted) |
| Readiness: 9 of 11 key fields complete  [Show every field]    |
+--------------------------------------------------------------+
| 1. KEY TERMS  (always open, large inputs)                     |
|   Issuer name | Currency | Size | Tenor / Maturity date       |
|   Coupon type (Fixed / Floating / FRN / Zero) | Coupon / rate |
|   Bookrunners (banks, Active/Passive, GC)     | Issue date    |
|   Pricing date | Settlement date | ISIN                       |
+--------------------------------------------------------------+
| 2. PRICING & EXECUTION  (opens from IPT stage)                |
|   IPT, Guidance, Reoffer spread / yield / price, Mid-swap,    |
|   Benchmark, Denomination, Issue price, Books                 |
+--------------------------------------------------------------+
| 3. MORE DETAIL  (collapsed, "Show 24 optional fields")        |
|   Issuer & ratings | Form & status | Interest details |       |
|   Listing & legal  | Selling restrictions | ESG / label       |
+--------------------------------------------------------------+
|  Drop a document here to suggest values (PDF, Word, XML)      |
+--------------------------------------------------------------+
```

- **All the fields already in the VDR** are kept (LEI, rating, outlook, CUSIP, common code, form of note, day count, business day convention, governing law, listing venue, optionality, ESG label, and the rest). They are sorted into the three layers above.
- **Stage-aware:** a section opens automatically once the deal reaches the stage that needs it. Fields that are required and still empty get an orange outline, and filled fields get a small green tick.
- **Show every field** switch at the top, plus a quick search box to jump to any field.
- **Document drop with review:** dropping a term sheet proposes values in a side-by-side list (current value crossed out, new value, source file), with Accept, Ignore and Accept all. Nothing is written without your approval, as in Claude's version. It uses the app's existing AI extraction, so it catches more than Claude's pattern rules.
- **Save** writes to the deal record and the Audit Log, and the AI Deal Checker re-runs straight away.

## Simpler ways to present the structure (built in)
1. Three layers instead of Claude's 17 sections: Key Terms, Pricing & Execution, More Detail.
2. About 11 key fields visible at Mandate and about 20 by Pricing, instead of 192.
3. Coupon type as a 4-button switch. Choosing Floating/FRN swaps "Coupon %" for "Margin over reference rate".
4. Bookrunners as tag chips with Active/Passive and GC toggles.
5. Maturity is typed once: entering a tenor suggests the maturity date and vice versa (using the existing maturity correction).

## Out of scope (later)
- Full ICMA BDT XML export in Claude's element order, and the 17-section expert view.
- Stage marker and version key on exports for multi-vendor feeds.

## Technical details
- New `src/components/termsheet/TermSheetFill.tsx` plus `fieldConfig.ts`. The config defines each field (key of `Deal`, label, type, layer, `fromStage`, `requiredAt`), adapted from Claude's `FIELDS`/`SECTIONS` but mapped onto the existing `Deal` type in `src/types`.
- New optional `Deal` fields where missing: `couponType`, `ipt`, `guidance`, `benchmark` (added to the type and to the cloud mapping in `cloudData.ts`; a migration adds nullable columns if the deals table stores columns individually. Check before writing).
- `DealsPage.tsx` `DealDetail`: wrap the existing grid in shadcn `Tabs` (View / Fill), with Fill visible only to users who can manage the deal. Save goes through `updateDeal` from `useScopedApp` plus `addAuditEntry`.
- Document drop reuses the `extract-deal-fields-ai` function and the existing `FieldDiffDialog`/`ExtractDealReviewModal` review pattern, with the 150k text cap.
- Styling uses only existing tokens, `Card`, `Badge`, `Collapsible`, `ToggleGroup`, and the orange-border button style already used on the toolbar.
