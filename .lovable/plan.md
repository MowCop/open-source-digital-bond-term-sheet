## Plan

Create `src/lib/bondValidator.ts` with the file content provided in the upload (605 lines, pure TypeScript bond deal validator).

### What it adds
- `validateDeal(deal: Partial<Deal>)` returning `ValidationResult[]` with severity-graded errors/warnings/info
- Helpers: ISIN/LEI/CUSIP/Common Code validators, business-day/holiday calendar (TARGET2/London/US), Modified Following date adjustment, size/tenor parsers, coupon date generation, yield/spread/coupon consistency, denomination minimums
- Exports: `Severity`, `ValidationResult`, `validateDeal`

### Notes
- Imports types from `@/types/bond` (already present)
- No new dependencies; comment mentions `date-fns` but the file does not actually import it
- No callers wired up — this just adds the library file. Hooking it into the New Issue / Deal Data form would be a follow-up

### Files
- Add: `src/lib/bondValidator.ts` (verbatim from upload)
