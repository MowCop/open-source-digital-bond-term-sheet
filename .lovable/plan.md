# AI Deal Checker across the full deal lifecycle

Today the Deal Checker only runs inside Create New Issue (AI Draft page), against AI-extracted draft fields. Once a deal is created and lives on the New Issue Board, no validation runs. This plan makes the checker run continuously on live deals, from creation through to pricing and settlement.

## What the user gets

1. **Traffic-light flag on every deal** — a red / orange / green dot on each row of the New Issue Board and of Termsheet Data:
   - Red: one or more blocking errors
   - Orange: warnings only (or overridden errors)
   - Green: all checks pass
2. **Deal Checker panel inside each deal** — the existing checker component, mounted in the expanded Termsheet Data panel and in the New Issue Board deal Focus Mode, listing every check with expandable detail and ICMA references.
3. **Always current** — re-validates automatically whenever deal fields change (AI DataParse, manual edit, stage advance, bulletin generation), so the flag is accurate at every stage up to Priced/Settled.
4. **Master Admin override preserved** — overrides remain available on live deals and are written to the audit log against that deal's ID (not "draft").
5. **Stage awareness** — checks that only make sense late in the lifecycle (final pricing terms, ISIN, settlement dates) are reported as informational before Books Closed and escalate to warnings/errors from Priced onwards, so early-stage deals are not permanently red.

## Technical approach

- **Reuse `validateDeal`** in `src/lib/bondValidator.ts`. No rule rewrites; add an optional stage parameter used to soften/escalate pricing-dependent rules by `DealStage`.
- **New hook `src/hooks/useDealChecker.ts`** — takes a `Deal`, memoises `validateDeal(deal, ctx, stage)`, returns `{ results, counts, flag }` where flag is `red | amber | green`. Deals are already full `Deal` objects, so no `aiFields` mapping is needed on this path.
- **`DealChecker.tsx` gains a `deal?: Partial<Deal>` input** alongside the existing `aiFields` path, so the draft page keeps working unchanged while live deals pass their record directly. Override state and audit emission stay as they are; the parent supplies `entityId = deal.id`.
- **`src/pages/DealsPage.tsx`** — flag dot in each deal row header; `<DealChecker deal={deal} .../>` rendered in `DealDetail`, wired to `addAuditEntry` with the deal's ID.
- **`src/pages/MessagesPage.tsx`** — flag dot in the board row (next to the existing Public Status dot) and the checker panel in Focus Mode, so bookrunners see issues while the deal is live.
- Validation is pure client-side computation over data already in context; no new tables, no backend calls, no extra load.

## Out of scope

- No change to existing validation rules' logic beyond stage-sensitivity.
- No persistence of check results to the database (overrides continue to go to the audit log only).
