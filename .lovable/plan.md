# Pre-Published vs Published + AI Build Pipeline

## Delivered in this iteration

- **New Issue Board status split** (`MessagesPage`): primary filter chips for `All / Pre-Published / Published / Retracted` with live counts, status badge on each row, coloured left border. Stage filter kept as secondary.
- **Vendor scope tightened**: read-only users now only see `status === "sent"` alerts — pre-published drafts can no longer leak via recipient inclusion.
- **AI Bulletin Extraction trigger mode** (`AIDraftPage` + `BondConsolePage`): user-selectable Live / On Save / Manual, persisted to localStorage. AIDraft reads it on file-drop and adds a "Run AI" button for manual triggering.
- **Differences (append-by-default) UI** in AIDraft: when a fresh extraction returns a value that differs from a non-empty existing field, the existing value is kept and an amber "Differences (N)" panel lets the user explicitly Replace or Keep per field.

## Deferred (next iteration)

- `extract-bulletin-from-chat` edge function (bulletin-shaped headline/body).
- Realtime chat → deal extractor worker in `AppContext` (debounced + cost-capped).
- Generalize `ExtractDealReviewModal` to accept the bulletin schema as well.
- "Pull from Deal Data" / "Pull from Chat" actions inside the bulletin builder for already-saved drafts.
