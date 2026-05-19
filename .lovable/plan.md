## Problem

In the Issue Board, historical updates (Update #1, Original, etc.) render as collapsed `AlertHistoryCard`s under "Update History". Their collapsed header currently shows only: version chip, sender, timestamp, status — but **not** the alert's own subject (e.g. "Republic of Italy EUR 10yr Books Open"). Each historical update has a unique headline that should be visible without expanding the card.

The latest update is unaffected — it renders `embedded={true}` and inherits the merged headline row above it.

## Change

Single-file edit in `src/components/AlertHistoryCard.tsx`, header block (the `{!embedded && (...)}` section).

Display `message.subject` in the collapsed/expanded card header, directly under the version chip row:

```text
┌─────────────────────────────────────────────────────────┐
│ ▸ [UPDATE #1]                                           │
│   Republic of Italy EUR 10yr Books Open      ← NEW LINE │
│   Jane Smith · syndicate                                │
│                          May 19, 10:14 AM   [sent]      │
└─────────────────────────────────────────────────────────┘
```

Details:
- Insert subject between the version-chip line and the sender meta line.
- Use `text-sm text-foreground font-medium`, truncate with `truncate` so long subjects don't push layout.
- Only render when `message.subject` is non-empty.
- Applies to both collapsed and expanded states (header is always visible in non-embedded mode).
- No change to embedded latest card (already shown via merged headline row).
- No change to `MessagesPage.tsx`, data model, or edit flow.

## Out of scope

- Latest update card (already merged into headline row).
- Edit/inline-rename of historical subjects.
- Body, attachments, distribution, or action buttons.
