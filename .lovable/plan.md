# Fix: AI DataParse ignores later corrections in chat

## What is happening

In the Kingdom of Nania chat the last messages say "Correction maturity will be 9 years not 10-years" / "Maturity will be 9 years not 20-years", yet the review panel still suggests `Tenor: 10Y` with 100% confidence.

Two things in the current implementation explain this:

1. The extraction prompt (`supabase/functions/extract-deal-from-chat/index.ts`) never tells the model how to handle contradictions over time. It asks it to "extract every bond term you can find" with no rule that a later message overrides an earlier one, so when the transcript contains both `10Y` (repeated many times through the deal) and a single late correction to 9 years, the model settles on the dominant value.
2. The same request also sends the existing deal record (`Kingdom of Nania USD 1.5bn 10y`) as matching context. That reinforces `10Y` — the model treats the stored value as confirmation rather than as the thing the correction is supposed to change.

Confidence is reported as 100% because the model is confident about `10Y` appearing in the chat; it is not a measure of whether it resolved the conflict.

## Fix

### 1. Teach the prompt recency and corrections (main fix)

In `supabase/functions/extract-deal-from-chat/index.ts`, extend `SYSTEM_PROMPT` with explicit conflict-resolution rules:

- The transcript is strictly oldest to newest. When the same field has more than one value, always return the value from the **latest** message that states it.
- Words such as "correction", "amend", "revised", "not X", "should be", "update" mark a supersession — the new value wins and the old one must be discarded.
- The existing-deal list is background context only, never evidence. If the chat contradicts the stored deal, the chat wins.
- When a field was corrected, cap its `fieldConfidence` at 0.7 and add an `alerts` entry naming the change (e.g. "Tenor corrected from 10Y to 9Y").

### 2. Make supersessions visible in the output

Add an optional `corrections` array to the JSON contract:

```
"corrections": [ { "field": string, "from": string, "to": string, "evidence": string } ]
```

Normalise and return it alongside the existing fields (safe to ignore by older clients).

### 3. Surface corrections in the review modal

In `src/components/ExtractDealReviewModal.tsx`, when `corrections` is non-empty show a small amber notice above the field table listing each `field: from → to`, and pre-tick those fields so a correction is never silently dropped.

### 4. Keep the newest part of long chats

`transcript` is already truncated with `text.slice(-MAX_CHARS)` (newest kept), which is correct — no change needed, but add a short note in the prompt that the transcript may start mid-conversation.

## Verification

- Re-run AI DataParse on the Kingdom of Nania chat: Tenor should suggest `9Y`, with a correction notice and a lowered confidence badge.
- Run a chat with no corrections to confirm behaviour is unchanged.

## Technical notes

- Files touched: `supabase/functions/extract-deal-from-chat/index.ts`, `src/components/ExtractDealReviewModal.tsx`.
- No database or schema changes.
- The edge function will be redeployed as part of the change and tested directly before hand-off.
