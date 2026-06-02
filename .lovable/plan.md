
# NewIssueVault — Pre-Published vs Published + AI Build Pipeline

## 1. Status model (no schema changes)

Today's `messages.status` already supports the split — we just need to use it consistently:

- `draft` / `pending_review` / `confirmed` → **Pre-Published** (Saved, not Sent)
- `sent` → **Published** ("Send" = "Publish")
- `retracted` → **Unpublished** (treated as Pre-Published with a "Retracted" sub-badge)

A bulletin keeps the same `id` across its lifetime: save creates Pre-Published, Send flips it to Published. No duplicate records, no migration.

## 2. New Issue Board UX

A single chronological board with strong visual separation, per your answer:

- **Status badge** on every row: `● Pre-Published` (amber) vs `● Published` (green) vs `○ Retracted` (grey).
- **Filter chips** above the list: `All` · `Pre-Published` · `Published` · `Retracted`. Default = `All`.
- **Sort** dropdown: Newest, Oldest, Last edited, Issuer A–Z.
- **Search** stays as-is.
- **Row affordance**: Pre-Published rows show a `Continue editing` button (opens AI Draft / Bond Console for that bulletin); Published rows show `View` and `Retract` (admin).
- **Count pills** on each chip (e.g. `Pre-Published 7`).
- Same chips re-used on the **Inbox** for vendors so they never see Pre-Published rows (vendors filter to `Published` only; chip hidden).

## 3. Bulletin build pipeline (Create New Issue → AI Draft → Bond Console)

A bulletin's Headline + Body + Attachments are populated from up to three sources, in this priority (per your answer):

1. **Documents dropped into the bulletin** (primary; uses existing `pdf-ocr-to-html` + `extract-deal-fields-ai`).
2. **Deal Data** (when no documents attached) — pulls live from `deals` row.
3. **The deal's Chat** — same `extract-deal-from-chat` edge function, but writing into bulletin draft instead of `deals`.

Each source has a manual override toggle in the Bond Console panel.

### Trigger modes (Bond Console setting, per bulletin)

Three radio options, default = **On Save**:

- a) Live / debounced (every few seconds)
- b) On Save + on every document drop ← **default**
- c) Manual only (`Run AI extraction` button)

Stored on the bulletin record as `ai_suggestions.triggerMode` inside the existing `ai_suggestions` JSONB column — no schema change.

### "Differences" review (replacing override prompt)

Whenever a new source produces a value that differs from what is already in the bulletin:

- The field stays as-is (append-by-default rule).
- An inline yellow diff chip appears next to the field: `Deal Data says "EUR 500m" → keep / replace`.
- A summary `Differences (3)` button at the top opens the existing `ExtractDealReviewModal` pattern, side-by-side, per-field accept/replace.
- No silent overrides, no all-or-nothing confirm.

## 4. Deal Data extraction (unchanged plumbing, more triggers)

`extract-deal-from-chat` already exists and writes to `deals`. We:

- Keep it for ad-hoc admin extraction (existing buttons).
- Add **real-time mode**: a small worker in `AppContext` debounces newly-arrived `chat_messages` per `deal_id` and calls the function on a 30s rolling window when the chat is "active". Cost cap: 1 call per deal per 60s; respects the existing per-user 10s limit.
- Reuse the same review modal so admins approve diffs before they hit `deals`.

## 5. Audit + telemetry

Every AI-driven write (bulletin field, deal field) writes an `audit_log` row with:

- `action`: `ai_fill_bulletin_from_document` | `ai_fill_bulletin_from_deal_data` | `ai_fill_bulletin_from_chat` | `ai_update_deal_from_chat`
- `details`: source, accepted fields, model, confidence.

## 6. Files affected (technical section)

### Frontend
- `src/pages/MessagesPage.tsx` — add status chips, filter, sort, count pills, Pre-Published vs Published rendering.
- `src/pages/InboxPage.tsx` — vendor view filters to `status === 'sent'`.
- `src/pages/AIDraftPage.tsx` — surface trigger-mode radio, hook "Pull from Deal Data" and "Pull from Chat" actions, replace silent auto-fill with diff-chip flow.
- `src/pages/BondConsolePage.tsx` — bulletin-side controls: trigger mode, source toggles, "Differences (N)" button.
- `src/components/ExtractDealReviewModal.tsx` — generalize to also accept bulletin field schema (not only deal taxonomy).
- New `src/components/BulletinDiffChip.tsx` — small inline keep/replace control.
- New `src/lib/bulletinSources.ts` — helpers that gather candidate values from Documents/Deal Data/Chat and produce a unified diff.
- `src/context/AppContext.tsx` — debounced chat→deal extractor worker (in-memory).

### Backend
- New edge function `extract-bulletin-from-chat` — thin variant of `extract-deal-from-chat` that returns bulletin-shaped output (`headline`, `body`, suggested attachments to keep, alerts).
- Reuse existing `extract-deal-fields-ai` and `pdf-ocr-to-html` for documents (no change).

### Schema
- **None.** Status flag already exists; trigger mode and source preferences live in the existing `messages.ai_suggestions` JSONB.

## 7. Out of scope (flag for follow-up)

- Auto-promoting Pre-Published → Published without admin click.
- A separate "Pre-Publish queue" for non-admins to review before Send.
- Versioning of bulletin content (we keep "last write wins" + audit log for now).
- Realtime collaborative editing of the same bulletin.
