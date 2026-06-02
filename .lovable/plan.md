## Goal

Add a self-contained, end-to-end example on the New Issue Board so anyone (including the default Master Admin) can:

1. See the deal on the New Issue Board with all key Deal Data populated.
2. Open the alert and see an Associated Chat Thread on the right with realistic, on-topic messages.
3. Click **AI Extract** on that chat and get an extraction that clearly matches the same deal (terms, bookrunners, lifecycle events).

The example must work for the default logged-in user (Sarah Chen / Master Admin / `u1`) — so she must be a participant of the chat channel, otherwise the chat panel shows empty in non-contextual contexts.

## Example deal

**Kingdom of Spain — EUR 3bn 7Y Senior Unsecured** (new mock id `d5`):

- Issuer: Kingdom of Spain
- Currency / Size / Tenor: EUR / 3,000,000,000 / 7Y
- Coupon: 3.10%
- Stage: **Books Open** (with realistic stage history: Mandate → Announced → Launched → Books Open)
- Bookrunners: GlobalBank (active, GC), EuroBank (active), Citi (passive)
- ISIN, LEI, ratings, reoffer spread (MS+62bps), mid-swap, denominations, governing law, listing venue, etc. — all populated so the Deal Data card looks complete.

## Bulletin / alert

New mock message `m6` linked to `d5`:

- Subject: "Kingdom of Spain EUR 7Y — Books Open at MS+65 area"
- Body: announcement-style copy with mandate, size, tenor, IPT, ratings, bookrunners, settlement date.
- One attachment (Spain_7Y_TermSheet.pdf, placeholder).
- Status: `sent`, sender `u2`, recipients across vendor users.

## Chat channel + messages

New channel `ch6` for `d5`:

- `participantIds`: **u1 (Sarah Chen), u2 (James Miller), u3 (Anna Schmidt), u4 (Mike Johnson), u7 (Elena Rodriguez)** — Sarah is included so the default session sees the thread without needing the read-only contextual fallback.
- Label: `Kingdom of Spain EUR 7Y — Deal Thread`.

8 chat messages (`cm12`–`cm19`) telling the deal story so AI Extract has rich, unambiguous content:

1. System bot: `[MANDATE] Kingdom of Spain EUR 7Y — mandate announced. Joint leads: GlobalBank (B&D), EuroBank, Citi.`
2. James (bank): "Pre-marketing kicks off today. Targeting Books Open Wed AM. IPTs MS+75 area indicative."
3. Anna (bank): "Investor calls scheduled tomorrow 10:00 CET. Roadshow deck attached." (mock attachment)
4. Elena (sales): "Initial feedback supportive at 7Y. Real-money pushing for tighter than IPTs."
5. System bot: `[BOOKS OPEN] IPT MS+75 area. Books opened 07:45 UKT.`
6. James (bank): "Books > EUR 18bn (ex-JLM). Revising guidance to MS+65 (±2) WPIR."
7. Mike (vendor): "Dissemination confirmed across Bloomberg terminals. Allocation logic confirmation needed for top-25 accounts."
8. James (bank): "Final spread MS+62. Coupon 3.10%, reoffer 99.825, yield 3.13%. Pricing 13:30 UKT, settlement T+5. Final term sheet to follow."

This sequence contains every field the extractor schema looks for: issuer, currency, size, tenor, reoffer spread, coupon, reoffer price/yield, settlement date, bookrunners, plus lifecycle events (mandate → books open → revised guidance → priced).

## AI Extract behaviour

No code or prompt changes to `extract-deal-from-chat` are needed — the existing function already:

- Receives the channel transcript + `conversationLabel` ("Kingdom of Spain EUR 7Y — Deal Thread") + existing deals.
- Will match the chat to `d5` (issuer + currency + tenor + bookrunners all line up), returning `mode: "update_existing"` with `matchedDealId: "d5"` and high confidence.
- Will surface `Reoffer Spread: MS+62`, `Coupon: 3.10%`, `Reoffer Yield: 3.13%`, etc. in the AI Extraction Review modal, and lifecycle events ("Books opened at MS+75", "Guidance revised to MS+65", "Priced at MS+62").

The fix already shipped in `SecureChat.tsx` (strict per-deal channel selection in contextual mode) means clicking AI Extract from the Edit Alert split-screen will use Spain's channel, not another deal's.

## Files

- `src/data/mockData.ts`
  - Append `d5` to `mockDeals`.
  - Append `m6` to `mockMessages`.
  - Append `ch6` to `mockChatChannels`.
  - Append `cm12`–`cm19` to `mockChatMessages`.
  - Add 1–2 matching `auditLog` entries (DEAL_CREATED for d5, MESSAGE_SENT for m6) and a notification.

No changes to context, edge functions, or UI components.

## Seeding note

Mock data only seeds when local/cloud state is empty. To guarantee the demo example appears for users who already have state:

- Add a small one-off "Reseed demo data" affordance? **Out of scope** — flagging only. For now, this plan assumes a fresh session or that the user clears `bondvdr.*` localStorage to pick up the new mock rows. If you want a "Reset demo data" button on the Admin page, say the word and I'll add it as a follow-up.