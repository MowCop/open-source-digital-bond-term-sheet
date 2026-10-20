# Co-Pilot General mode

## What you'll see
- Wherever the Co-Pilot has no deal, update or chat to focus on (New Issue Board with nothing open, Bond Console, Admin pages, Settings and so on), the grey "Open a term sheet, update or chat…" hint turns into a working **Deal Co-Pilot · General** box.
- You can ask it anything about the VDR: how to do things, where features are, FAQs (roles, stages, Deal Checker, term sheets, documents, bell alerts). Answers can include links that take you to the right page.
- **Remind me** — you ask, for example, "Remind me when MBH Bank is Free to Trade" or "Remind me 1 day before Al Rajhi settles". Co-Pilot repeats the reminder back and asks you to confirm before saving it. Nothing is set up unless you ask.
- You can ask "What reminders do I have?" or "Cancel the MBH reminder". Reminders show in a small list in the General panel, and each has a cancel button.
- **When reminders go off:** only while you are using the VDR. Each time you open or use it, due reminders light the bell (top right) with a "Reminder" alert. They don't run in the background and don't send email.
- **Memory:** your General conversation is saved across visits and devices, with a "New conversation" button.
- **Suggestions while typing:** as you type, a short list of likely questions appears (from common FAQs, deal names and your past questions). Use the arrow keys/Enter or click to pick one.
- When you open a deal, update or chat, the focused Co-Pilot works exactly as it does now.

## Scope limits
- General mode only reads what you can already see, and it can't change deal terms.
- The only alert control it has is creating and cancelling your own reminders. It doesn't mute alerts or mark them read.

## Technical details
- New tables (RLS: own rows only; `user_id` uuid, no FK to auth):
  - `copilot_general_messages(id, user_id, role, content, created_at)` — the saved conversation.
  - `copilot_reminders(id, user_id, deal_id null, label, trigger_kind ['stage_reached','date'], trigger_stage null, due_at null, status ['active','fired','cancelled'], created_at, fired_at)`.
- New edge function `copilot-general` (JWT validated in code, zod input). It uses the existing `_shared/ai-model.ts` (Claude, default Sonnet 5) with tools:
  - `list_my_deals` — RLS client, names/stages/key dates.
  - `vdr_faq` — a static help library in `knowledge/vdr-help.ts` covering pages, roles, stages, alerts and how-tos.
  - `propose_reminder` — returns a draft only. The browser shows a Confirm card, and confirming inserts the row through the RLS client. The AI never saves a reminder itself.
  - `list_reminders` / `cancel_reminder` (cancel also confirmed in the UI).
- `src/lib/copilot/reminders.ts`: an evaluator runs on app load, on deal changes and every 60s while the tab is open. It marks due reminders `fired` once (atomic update `where status='active'`) and inserts a `notifications` row of type `reminder`, which feeds the existing bell count. "Free to Trade" maps to the deal's settlement/free-to-trade date or the final "Settled" stage.
- `src/components/CopilotGeneral.tsx` follows DealCopilot's compact header and dropdown styling. `CopilotFocusHost` renders it when there is no focus and we're not on a Digital Term Sheet deal. It replaces the placeholder in `AppLayout`.
- Typing suggestions are client-side (FAQ question list + deal names + past user questions), with no AI call per keystroke.
- Bell click: reminder alerts link to the deal; chat-invite behaviour is unchanged.
- Tests: reminder evaluator (stage reached fires once; date due fires once; cancelled never fires; future dates don't fire).
- Update AGENTS.md with a General-mode rule (AI drafts reminders, the user confirms; reminders only go off client-side).
