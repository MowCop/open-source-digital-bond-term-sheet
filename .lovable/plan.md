Add Lithuania's (or any deal's) full Chat thread inside the Edit Alert modal so the bulletin and its associated chat are visible side-by-side and stay logically linked.

`SecureChat` already accepts `activeDealId` and renders a deal's full thread, so we can embed it inside the existing `AlertHistoryCard` edit dialog without rebuilding the chat. The alert already knows its `message.dealId`, so we can pass it straight in.

## Option A — Split screen (recommended)
Two-pane layout inside the existing modal:
- Left pane: Bulletin editor (subject, RichTextEditor body, attachments) — what you see today
- Right pane: Read-only Chat thread for the same deal (latest at bottom, auto-scrolls, no composer — view-only context)
- Both panes share the same header ("Back to Issue Board" + "Edit alert — <Deal headline>")
- Divider is draggable so the user can widen either side; defaults to ~60/40 in favour of the bulletin
- Footer (Cancel / Save / Save & Send) spans both panes

This keeps the bulletin as the primary action surface and treats chat as live, anchored context.

## Option B — Expandable headlines (accordion)
Two stacked sections in the modal, each with its own headline bar:
- "Bulletin — <subject>"
- "Chat — <deal headline>"
- Click either headline to expand it; the other collapses to a thin bar. Only one expanded at a time.
- Preserves vertical space on small screens; less useful for cross-referencing while editing.

## Option C — Tabs
Two tabs at the top of the modal body: **Bulletin** | **Chat**. Simplest, but loses the "see both at once" benefit you asked for.

## AI association (applies to A and B)
- Highlight chat messages that the AI used to draft/edit this bulletin (subtle left border + "Used in draft" chip)
- "Insert into bulletin" button on each chat message (sends quoted text to the editor)
- "Refresh from chat" button in the bulletin header — re-runs the AI extraction over the latest chat and proposes updates as tracked changes
- Unread chat messages since the bulletin was last saved get a small "New since draft" badge

## Implementation notes (technical)
- File: `src/components/AlertHistoryCard.tsx` — the `<Dialog>` for `editing` already exists; replace the single editor column with a `<ResizablePanelGroup>` (shadcn `resizable`) when Option A is chosen
- Embed `<SecureChat activeDealId={message.dealId} heightClass="h-full" />` in the right pane, wrapped with a `readOnly` prop addition (small change in `SecureChat` to hide the composer)
- AI-association hooks can reuse the existing `extract-deal-from-chat` edge function pattern; the "Insert into bulletin" / "Refresh from chat" actions are additive and can ship after the split-screen lands
- Mobile (<768px): fall back to Option B (stacked accordion) automatically

Please pick A, B, or C (and confirm whether to include the AI-association extras now or later) and I'll implement.