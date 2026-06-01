# AI Deal Extractor for Chat Threads

Add an "Extract deal info" action on any chat thread / message group. The action sends the full conversation to an AI edge function, which returns either (a) a draft for a new deal or (b) suggested field updates for an existing deal, for a Syndicate/Master Admin to review and confirm.

## User flow

1. On a thread in `MessagesPage` (alert group) and on a channel in `SecureChat` / `FloatingChatPanel`, show an **"Extract deal info (AI)"** button (Admins only).
2. Clicking it:
   - Collects the full ordered message body + attachment filenames for that thread/channel.
   - Calls a new edge function `extract-deal-from-chat`.
   - Shows a loading state, then opens a **review modal**.
3. The review modal shows:
   - AI's decision: `new_deal` or `update_existing` (with the matched deal + match confidence/reason).
   - All extracted ICMA fields side-by-side: current value (if update) vs AI-suggested value, each with a checkbox.
   - Bookrunners list with add/keep/remove toggles.
   - Free-text "AI notes" (e.g. "Pricing announced, books closed at 1.2bn").
4. User picks fields to accept, then confirms:
   - **New deal** → inserts a new row in `deals` with selected fields, stage defaulting to the AI's suggested lifecycle stage.
   - **Update existing** → patches only the accepted fields on the matched deal; appends a `stage_history` entry if stage changed.
5. Action written to `audit_log` (`ai_extract_from_chat`, entity = thread/channel id, details = JSON of accepted changes).

## Backend — new edge function `extract-deal-from-chat`

- Auth: require authenticated admin (mirror `extract-deal-fields-ai`).
- Input: `{ source: 'thread' | 'channel', sourceId: string }`.
- Server-side:
  1. Load messages for that thread/channel ordered by time (RLS-respecting service-role read after admin check).
  2. Load a lightweight list of existing deals (`id, issuer_name, currency, size, tenor, stage, isin`) to give the model context for matching.
  3. Call Lovable AI Gateway (`google/gemini-2.5-pro` for accuracy; fall back to `gemini-3-flash-preview`) with a system prompt that extends `extract-deal-fields-ai`'s prompt to also:
     - Decide `mode: "new_deal" | "update_existing"`.
     - When `update_existing`, return `matchedDealId` + `matchReason`.
     - Suggest a `stage` from the existing lifecycle vocabulary.
     - Return `alerts: string[]` summarising lifecycle events found in chat (pricing, books closing, allocations, settlement) — feeds `AlertHistoryCard` later.
  4. Use AI SDK `Output.object` (Zod schema) so output is validated, not regex-parsed.
- Output: `{ mode, matchedDealId?, matchReason?, keyTerms, bookrunners, suggestedStage, alerts }`.

## Frontend changes

- New `src/components/ExtractDealFromChatButton.tsx` — admin-only action button.
- New `src/components/ExtractDealReviewModal.tsx` — diff/review UI built on existing `ui/dialog` + `ui/checkbox`. Maps AI's `keyTerms` keys to the `deals` columns via the same mapping already used in `extract-deal-fields-ai` consumers (`src/lib/alertParsing.ts`).
- Wire button into `MessagesPage` (per alert group) and `SecureChat` / `FloatingChatPanel` (per channel header).
- On confirm: existing `createDeal` / `updateDeal` in `AppContext` (no new client write paths needed).

## No schema changes required

All extracted output maps onto existing `deals` columns + `bookrunners` JSON. The action is logged via the existing `audit_log` table.

## Technical notes

- Reuses `LOVABLE_API_KEY` (already provisioned). No new secrets.
- Function uses the shared AI gateway helper pattern (Lovable AI), JSON mode via AI SDK `Output.object`.
- Long threads: truncate to most recent ~150 messages / ~30k chars before sending, with newest preserved.
- Rate-limit per user (in-memory map keyed by `auth.uid()` — 1 call per 10s) to avoid runaway costs.
- Errors (429/402/validation) surfaced as toasts in the review modal.

## Out of scope (can follow up)

- Automatic background scanning of every new message.
- Auto-creating `AlertHistory` entries — for now the `alerts[]` array is shown in the review modal as informational only.
