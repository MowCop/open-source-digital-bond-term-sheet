# Co-Pilot: documentation-first, external sources, no chats

## What changes for you

1. **Digital Term Sheet answers lead with the deal documents.** When a term sheet is open, Co-Pilot reads the deal's saved documents first (offering circular, term sheets, supplements) and quotes them with the file name. If the documents don't cover a question it says so instead of guessing.
2. **Deal and borrower questions can use outside sources**, always labelled by source and date:
   - Free public sources: issuer filings (SEC EDGAR), GLEIF and OpenFIGI (already there), central bank and issuer websites via web search.
   - Paid subscriptions (Moody's Analytics, S&P, Fitch, Bloomberg): for this demo, Co-Pilot treats the user's subscription as connected. Answers from these are clearly marked "Demo subscription data, illustrative only" so nobody mistakes them for real ratings or research.
3. **Co-Pilot no longer reads chats anywhere.** Clicking a chat in My Deal Chats no longer sends chat text to Co-Pilot; the top bar shows General mode there instead. Board updates and term sheets keep their focus.

## Technical details

- `supabase/functions/deal-copilot/agent.ts`: system prompt gains a documentation-first rule (call `readDocuments`/`readSource` before answering term-sheet questions, cite file names, state gaps). New tools `searchPublicSources` (web search via the AI gateway plus EDGAR full-text search, results returned with URL and retrieval time) and `querySubscriptionSource({provider, borrower, topic})`.
- `querySubscriptionSource` lives in `knowledge/tools.ts`; in demo mode it returns a response stamped `demo: true, provider, retrievedAt`, and the prompt requires the "illustrative demo data" label. A per-provider switch makes it easy to plug a real API key later via secrets — no real keys or paid calls now.
- Remove chat focus: `InboxPage.tsx` stops calling `setCopilotFocus` for chats; `CopilotFocus.kind` narrows to `"update"`; `focusPrompt` and `DealCopilot` placeholder drop the chat branch; `CopilotFocusHost` shows General mode on /inbox.
- Update `supabase/functions/deal-copilot/AGENTS.md` (focus rule now update-only; external source rule) and `reference/deal-checker-capabilities.md` only if checker sources change (they don't — Deal Checker stays deterministic).
- Tests: focus no longer accepts chat; subscription tool always marks output as demo; existing Co-Pilot tests keep passing. Redeploy deal-copilot.
