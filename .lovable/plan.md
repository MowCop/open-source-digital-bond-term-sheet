# Multi-tranche DTS: proposed screen layout (for review)

Layout review only. Nothing on screen changes until you approve.

## Screen 1: Deal structure (opens after New Deal confirms the borrower)

```text
+-----------------------------------------------------------------+
| Deal structure: Sasol                                     [x]   |
|                                                                 |
| How many tranches?   [-] 3 [+]                                  |
| Rate type            ( ) All fixed  ( ) All floating  (o) Mixed |
|                                                                 |
| Planned totals (optional)                                       |
|   USD  [ 1,000,000,000 ]     EUR [  500,000,000 ]   [+ currency]|
|   [ ] Not yet determined                                        |
|   USD equivalent (indicative): 1,550,000,000                    |
|   EUR rate 1.1000 · ECB · 9 Nov 2026          [Edit rate] [Lock]|
|                                                                 |
| Tranche  Rate type   Currency  Amount (optional)  Tenor         |
| A        Fixed  v    USD       600,000,000        5y        [..]|
| B        Floating v  USD       400,000,000        3y        [..]|
| C        Fixed  v    EUR       500,000,000        7y        [..]|
|                                       [+ Add tranche]           |
|                                                                 |
| Suggested from document: 3 tranches (p.2)   [Use] [Ignore]      |
|                                                                 |
|                              [Cancel]   [Create term sheets]   |
+-----------------------------------------------------------------+
```
- [..] menu: duplicate, move up/down, remove (asks you to confirm if it already has data).
- Totals check: "USD 1,000m matches tranches" or "EUR: 1 tranche amount still unknown".

## Screen 2: Deal term sheets (the new default tab)

```text
Sasol                                 Announced v   [Save]  [Bulletin]
Deal Checker: 2 errors · 3 warnings  (click to open)  [Attach] 4 files
-----------------------------------------------------------------------
Deal term sheets | All fields | BDT XML | DLT view | Documents
-----------------------------------------------------------------------
Shared deal terms  Borrower Sasol · Bookrunners BNP, JPM · Law English
Totals  USD 1,000m · EUR 500m · ~USD 1,550m equivalent (indicative)

  Tranche  Ccy/Amount     Type      Tenor  IPT / Guidance     Status
> A        USD 600m       Fixed     5y     T+200bp area       2 warn
  B        USD 400m       Floating  3y     SOFR+180 area      ok
  C        EUR 500m       Fixed     7y     MS+150 area        1 error
-----------------------------------------------------------------------
Tranche A (Fixed)                                      [Duplicate] [..]
 Key commercial terms   Amount · Issue price · Maturity · IPT
 Interest terms         Coupon · Frequency · Day count
 Legal / identifiers    Issuer · ISIN · Listing · Governing law
```
- Click a row to open that tranche's term sheet underneath; only one large form at a time, even with 10 tranches.
- Floating tranches show benchmark, margin, reset/fixing, caps/floors instead of coupon.
- Values inherited from shared terms are marked; a tranche's own value shows an "override" tag.
- Small screens: a tranche dropdown plus compact list instead of the wide table.

## Screen 3: All fields (renamed Fill)

```text
Scope: (o) Shared deal  ( ) Tranche [ A v ]        Search fields [   ]
Issuer ...  Bookrunners ...  Currency ...  (sections as today)
```
- Same data as Screen 2; edits show instantly in both places.

## Deal Checker (opened)

```text
Errors (2)
  Tranche C · ISIN check digit invalid            [Go to field] [Fix]
  Shared · EUR total does not match tranches      [Go to field]
Warnings (3)
  Tranche A · EUR FX rate older than 3 days       [Update rate]
  ...
Passed checks (24)  [show]
```

## Bulletin preview

```text
Sasol – Multi-tranche USD/EUR – IPTs
Intro (your text, kept)
Tranche | Ccy | Size | Tenor | Type | IPT
A       | USD | 600m | 5y    | Fixed| T+200bp area
...
USD equivalent ~1,550m (indicative, ECB 9 Nov 2026)
Notes (your text, kept) · Legal notices (sourced)
```

## Questions for your review
1. Is Deal term sheets the right default tab, or should All fields stay first?
2. Should the USD equivalent appear in bulletins, or only inside the app?
3. Are the table columns (Ccy/Amount, Type, Tenor, IPT/Guidance, Status) the right ones?
