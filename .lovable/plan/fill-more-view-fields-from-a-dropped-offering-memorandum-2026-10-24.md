# Fill more View fields from a dropped Offering Memorandum

## What the Sasol OM actually contains (checked against the uploaded file)

| View field | In the Sasol OM? | Value |
|---|---|---|
| Temporary ISIN / CUSIP / Common Code | No - only the generic phrase "same CUSIP, ISIN, Common Code"; codes are not printed in this preliminary OM | stays empty |
| Issuer / Guarantor rating | No - Moody's and S&P are only defined (for Change of Control); no actual rating stated | stays empty |
| Issuer | Yes | Sasol Financing USA LLC |
| Guarantor | Yes | Sasol Limited |
| Size / Currency | Yes | USD 750,000,000 |
| Maturity | Year only ("2033"), day left blank | stays empty (no guessed date) |
| Status of Note | Yes | Senior, unsecured, unsubordinated |
| Payment Frequency | Yes | Semi-annual |
| Day Count | Yes ("360-day year of twelve 30-day months") | 30/360 |
| Specified Denomination | Yes | 200,000 (+ 1,000 multiples) |
| Form of Note | Yes | Registered, global notes via DTC |
| Governing Law | Yes | New York |
| Listing Venue | Yes | Frankfurt Stock Exchange (Open Market) |
| Selling Restrictions | Yes | Rule 144A / Regulation S |
| Optionality | Yes | Make-whole call, par call, tax call, change-of-control put (101%) |
| Business Day | Yes (New York and London days) | Business day centres only |
| Coupon, Issue Price, Pricing/Settlement dates | Blank in preliminary OM | stay empty |

So the ISIN mention was a general expectation; for Sasol there is no code to parse. The change below still picks up ISIN/CUSIP/Common Code and ratings whenever a document does state them (e.g. a final OM or pricing supplement).

## What will change

1. The document reader also looks for: ISIN, CUSIP, Common Code, Guarantor name, Form of Note, Selling Restrictions (144A / Reg S category, TEFRA), Optionality, Business Day Convention, and actual agency ratings (only when a rating value is stated, never from definitions).
2. On New Deal and on dropping into Fill, these appear as proposals for review, the same way as today; nothing is applied without acceptance, user entries are never overwritten.
3. Accepted values show up in the View sheet straight away.
4. Placeholders, blanks and "will apply to list" style guesses about values are left empty, and the reader is told not to treat rating definitions or generic "CUSIP, ISIN" wording as values.

## Technical details

- `supabase/functions/extract-deal-fields-ai`: add keys ISIN, CUSIP, Common Code, Guarantor, Form of Note, Selling Restrictions, Optionality, Business Day Convention, Ratings[] (agency, value, outlook, rated entity); prompt rules: only stated values, validate nothing inferred.
- `src/lib/documentIntake.ts`: map new keys - identifiers via ISIN check digit / 9-char CUSIP / 9-digit Common Code into an `ids` group proposal; ratings into a `ratings` group proposal (agency codes MOODYS/SNPG/FITCH); TEFRA / RegS / form / optionality / business day into dictionary enums via `fieldByPath`; guarantor as parties proposal. Listing map gains Frankfurt (already in dictionary).
- Vendored `src/lib/termsheet/` untouched; `node verify.mjs` and `verify-dlt.mjs` keep passing.
- Tests in `src/test/documentIntake.test.ts`: ISIN with bad check digit rejected; generic "CUSIP, ISIN" text yields no ids; rating definitions yield no ratings; Frankfurt listing maps; 30/360 preserved.
- Verify end-to-end by dropping the real Sasol OM into New Deal, accepting proposals, and checking View.
