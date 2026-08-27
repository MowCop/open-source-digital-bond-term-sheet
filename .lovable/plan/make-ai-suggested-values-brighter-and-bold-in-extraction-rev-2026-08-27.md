# Make AI Suggested values brighter and bold in extraction review modal

## Goal
In the **AI Deal Extraction — Review** modal, the values shown under the **AI Suggests** column should stand out more clearly from the **Current** column.

## Change
Update `src/components/ExtractDealReviewModal.tsx`:
- Make every non-empty value in the **AI Suggests** column bold (`font-semibold` or `font-bold`).
- Increase brightness/contrast for AI-suggested values by using a brighter foreground color token (e.g. `text-foreground` or a brighter accent) instead of `text-muted-foreground`.
- Keep the existing `text-accent` highlight for values that differ from the current deal, but add bold weight so changed suggestions are even more prominent.
- Empty/placeholder "—" values can remain muted.

## Verification
- Open the AI extraction review modal for a deal/chat with extracted suggestions.
- Confirm the **AI Suggests** column text is bold and brighter than the **Current** column.
- Confirm changed values still use the accent color and are bold.
