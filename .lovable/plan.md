# One master AI button with Run options

Replace the current armed AI DataParse + separate source row with a single, clearly-labelled master AI control that opens a small options panel. The AI Deal Checker stays exactly where it is, unchanged and visually distinct.

## What the user sees

Toolbar top row:

```text
[Termsheet Data] [Edit Latest] [AI DataParse ▾] [OrderBook] [Deal Checker ●]
[Chat (2)] [Docs (1)] [History (6)] [Save] [Save & Send] [Retract]
```

Clicking **AI DataParse** opens a compact drop-down panel directly under the button:

```text
Parse deal data from:
  [x] Chat thread            (messages in this deal)
  [ ] Documents (coming soon) (3 attached)
                       [Run AI Parse]
```

- Both options are check-style rows; one or both can be chosen, at least one always stays selected.
- Chat is ticked by default, so the familiar behaviour is one click away.
- Documents shows a "coming soon" note; ticking it does not change what is sent — extraction still reads the chat thread.
- **Run AI Parse** starts the existing extraction review panel exactly as today.
- Clicking outside, pressing Escape, or clicking the button again closes the panel.
- After a run starts, the panel closes automatically.

## What moves back

Chat and Docs return to being plain buttons in the toolbar (open the chat panel / open the attached-documents list). They are no longer dual-purpose source toggles — source selection lives only inside the AI panel.

## Deal Checker

Unchanged: same position, same bottle-green styling with the shield icon and traffic-light dot, still opens its own panel. The AI parse panel never covers or interacts with it.

## Technical notes

- All changes in `renderDealActions` in `src/pages/MessagesPage.tsx`, using the existing shadcn `Popover` for the options panel.
- Replace `parseArmed` state with `parseOpen` (per `groupKey`); keep `parseSources` and `parseRunSignals` as they are.
- `ExtractDealFromChatButton` keeps its `onArmToggle` / `armed` / `runSignal` props — `armed` now reflects popover-open state, and Run still fires via `runSignal`. No change to `supabase/functions/extract-deal-from-chat`.
- Restore the original click handlers for Chat and Docs (remove the `armed` branch).
