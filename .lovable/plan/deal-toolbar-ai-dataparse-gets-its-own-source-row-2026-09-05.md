# Deal toolbar: AI DataParse gets its own source row

## What changes

1. **AI DataParse becomes a two-step control.** Clicking it no longer runs extraction straight away. It highlights (armed) and reveals a small second row directly beneath it labelled "From:" with two choices — **Chat** and **Docs** — that can be picked one or both.
2. **Chat and Docs move down.** They are removed from the main top row and now live only in that row under AI DataParse. They keep their existing behaviour when clicked normally (Chat opens the chat panel, Docs opens the attached-documents list) and additionally act as the source selection for the parse.
3. **Docs as a parse source is shown but not yet live.** Selecting Docs marks it as "coming soon"; the actual extraction still reads the chat thread. Chat is selected by default so the current behaviour is one extra click away, not lost.
4. **Run/close.** With sources chosen, a **Run** action next to the source row starts the extraction exactly as today (same review panel). Clicking AI DataParse again collapses the row and disarms it.
5. Nothing else in the toolbar moves: Termsheet Data, Edit Latest, OrderBook, Deal Checker, History, Save, Save & Send, Retract keep their positions and styling. The row wraps so the layout stays tidy at the current panel width.

## How it looks

```text
[Termsheet Data] [Edit Latest] [AI DataParse] [OrderBook] [Deal Checker]
                                From: [Chat] [Docs (1)]  [Run]
[History (6)] [Save] [Save & Send] [Retract]
```

## Technical notes

- All edits in `renderDealActions` in `src/pages/MessagesPage.tsx`, plus a small prop on `src/components/ExtractDealFromChatButton.tsx` so the button can be used as an arm/toggle and have its run triggered externally (or expose an `onRun` handler rather than firing on click).
- Per-group armed state (`parseArmed`) and source state (`parseSources: {chat, docs}`) held in `MessagesPage` state keyed by `groupKey`, so only the open deal panel shows the row.
- Source chips reuse `.toolbar-btn` with `toolbar-btn-selected` for the active state; the champagne styling stays on AI DataParse only.
- Docs source shows a "coming soon" toast on select and does not change the payload sent to `extract-deal-from-chat`.
