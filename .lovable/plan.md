

## Goal

When a user edits an existing Eurofima-style alert in Master Deal Alerts, the system should **clone** the original instead of overwriting it: the first version is preserved in history, and the edit becomes a new "update" entry. Any new fields parsed from the updated text (bookrunners, size, spread, ISIN, stage, etc.) flow back into the parent Deal so all other parts of the app stay in sync.

## Current Behaviour (the problem)

In `src/components/AlertHistoryCard.tsx`, clicking **Edit → Save Changes** calls `onUpdate(message.id, { subject, body })` which mutates the existing message in place. There is no version history — the original headline/body is lost. The Deal record is also never re-parsed, so updates like a newly-announced size or bookrunner don't propagate.

## Proposed Solution

### 1. "Edit as new update" flow (clone, don't overwrite)

In `AlertHistoryCard.tsx`, replace the single **Edit** button with two actions on a sent alert:
- **Edit (correct typo)** — current in-place edit, kept for fixing mistakes on a draft or genuine corrections.
- **Post Update** — the new default action. Opens the same edit UI but on Save:
  1. Creates a **new Message** (clone) with the same `dealIds`, `recipients`, `senderId`, a new `id`, status `draft`, `parentMessageId = original.id`, `threadId = original.threadId ?? original.id`, and the edited subject/body/attachments.
  2. Leaves the original message untouched (status stays `sent`, visible in history).
  3. The new draft appears at the top of the alert's history with a **Send** button so the user can review and dispatch it (matching today's draft → send flow).

### 2. Re-parse and merge into the Deal

When **Post Update** is saved, run the same AI extraction used in `AIDraftPage.tsx` (`simulateAIExtraction` + `extractBookrunners`) over the new body and call `updateDeal(dealId, mergedFields)` where:
- Newly-found values **fill blanks** on the deal (early-stage fields are often empty by design).
- Newly-found values **overwrite** existing ones only when they differ and are non-empty (e.g. size moves from "TBD" → "EUR 500m"; stage advances Mandate → Launched if detected).
- Bookrunners are **merged** (union by name; role upgraded if "global coordinator" appears).

This keeps the Master Deal Alerts row, Deals page, and any downstream views consistent without manual re-entry.

### 3. Stage auto-progression (light touch)

If the updated body contains stage cues ("books open", "priced at", "settled"), advance `deal.stage` and append to `stageHistory`. Otherwise leave the stage alone.

### 4. UI changes in the expanded alert history

- History list already sorts newest-first — the new draft will naturally appear above the original sent version.
- Add a small "Update #N" label per entry (computed from position in the thread) so users can see version progression at a glance.
- Original sent alerts get a **Post Update** button (primary) plus **Edit** (secondary, for true corrections) plus **Retract**.
- Drafts keep today's **Edit / Send / Retract** behaviour.

### 5. Files touched

- `src/components/AlertHistoryCard.tsx` — add `onPostUpdate` prop, new button, version label.
- `src/pages/MessagesPage.tsx` — wire `onPostUpdate` to a handler that `createMessage`s a clone and triggers re-parse.
- `src/pages/AIDraftPage.tsx` — export the existing `simulateAIExtraction` and `extractBookrunners` helpers (or move them to `src/lib/alertParsing.ts`) so `MessagesPage` can reuse them without duplication.
- `src/context/AppContext.tsx` — confirm `updateDeal` exists; if not, add it (small addition, persisted via the existing localStorage layer).

### Result

Posting an update to the Eurofima alert preserves the original "Mandate" alert in history, creates a new draft with the fuller text (size, spread, ISIN, additional bookrunners), and on Send the parent Deal is automatically enriched — so the Bookrunners column, stage badge, and any future Deal detail view all reflect the latest information without losing the audit trail.

