## Plan

Add `src/components/DealChecker.tsx` from the upload (verbatim, 329 lines).

Exports default `DealChecker({ aiFields, aiBookrunners })`. Uses `validateDeal`, `countBySeverity`, `isReadyToPublish` (all already exported from `src/lib/bondValidator.ts`) plus `Bookrunner`/`Deal`/enum types from `@/types/bond` and the existing shadcn `Badge`. Debounces validation 400ms on prop change.

Not wiring it into `AIDraftPage.tsx` in this step — just the file. Wiring is a one-liner follow-up.

### Files
- Add: `src/components/DealChecker.tsx` (verbatim from upload)
