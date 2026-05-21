## Goal

Replace the right-column grid that squeezes the Issue Board with a chat surface that:
1. By default, **floats** over the board, anchored to the originating row, non-modal.
2. Can be **expanded into a full Modal Dialog** for focused conversations.
3. Closes via multiple easy affordances.

## Why change current behaviour

Today, clicking the row's chat box flips `showChat = true` and `MessagesPage.tsx` (L330) switches the layout from `grid-cols-1` to `grid-cols-3`, mounting `SecureChat` in the right 2 columns. On the user's 792 px viewport this crushes the Issue Board (Headline/Bookrunners truncate, the open row scrolls partially off) and the only close affordance is a small "Close Chat ✕" text link.

## Three view modes for the chat

The same `SecureChat` content is rendered in one of three shells. The mode is a session preference toggled from the panel header.

### A. Floating panel (default)

- `position: fixed`, `z-50`, 380 px × 70 vh, anchored to the right edge of the viewport, vertically aligned with the originating row when possible. Margin 16 px from edges.
- Header: borrower · stage badge · channel selector · **[Dock]** · **[Expand to dialog ⛶]** · **[X]**.
- Small caret/arrow pointing to the originating row's chat box + brief `zoom-in-95 fade-in-0` animation so the user sees where it came from.
- Non-modal: board remains scrollable and clickable underneath; row's chat box stays in active/filled state.
- On viewports < 900 px, shell falls back to bottom-sheet (`inset-x-2 bottom-2 h-[70vh]`).

### B. Docked right drawer

- Same content but pinned to the right edge as a 380 px-wide persistent panel; board reflows to `pr-[396px]` instead of `grid-cols-3` (so columns don't get re-shaped, just margin-shifted).
- Toggled from the floating panel's [Dock] button. Session-only preference.
- Closes via [X] in header (returns to floating) or Esc.

### C. Modal Dialog (new, per user request)

- Triggered by the [Expand to dialog ⛶] button in the floating or docked panel, **or** by Shift-clicking the row's chat box, **or** by pressing `F` while a deal row is expanded and its chat is open.
- Uses shadcn `Dialog` (`src/components/ui/dialog.tsx`) — full Radix modal with backdrop dim, focus trap, and built-in Esc-to-close.
- Sized large: `max-w-3xl w-[min(900px,95vw)] h-[min(80vh,720px)]` so users can hold a longer conversation, see more history, and use the channel selector comfortably.
- Header mirrors the floating panel header (borrower, stage, channel selector) plus a **[Collapse to panel ⤡]** action that closes the dialog and reopens the floating panel anchored to the same row, preserving channel/scroll state.
- Closes via [X], Esc, or backdrop click (Dialog defaults).
- Because it is modal, the underlying board is dimmed/inert; this is the intentional "focus on this conversation" mode.

### State machine

```
closed ──open──► floating ──[Dock]──► docked
   ▲                │                    │
   │             [Expand]            [Expand]
   │                ▼                    ▼
   └──close──── modal-dialog ◄───────────┘
                   │
              [Collapse]→ returns to previous (floating | docked)
```

A single `chatView: 'closed' | 'floating' | 'docked' | 'modal'` state in `MessagesPage` drives this, plus `chatPrevView` so [Collapse] knows whether to return to floating or docked.

## Anchoring & deal context (all three modes)

- Header always shows: borrower (clickable → scrolls underlying row into view + 600 ms border pulse), stage badge, deal currency/size, channel selector when the deal has multiple channels.
- Originating row's chat box stays in `bg-primary` active state while any of the three views is open.
- Clicking a different row's chat box swaps the contents of the existing view (single instance, no stacking) and updates the anchor.
- Auto-close when the user collapses the originating deal row, so chat doesn't dangle for a hidden deal.

## Close affordances (summary)

| Mode | X button | Esc | Click outside | Re-click row box | Backdrop |
|---|---|---|---|---|---|
| Floating | ✓ | ✓ | ✓ (configurable, default on) | ✓ toggles closed | n/a |
| Docked | ✓ | ✓ | n/a (intentionally persistent) | ✓ toggles closed | n/a |
| Modal | ✓ | ✓ (Dialog default) | n/a | n/a | ✓ (Dialog default) |

Esc never collapses the expanded deal row while chat is open — it only closes the chat surface. Pressing Esc again then runs the existing row-collapse cascade.

## Why also include the Modal Dialog

Floating is great for "glance and reply"; Modal is the right shell for:
- Long onboarding/legal Q&A threads where the board is a distraction.
- Screen-share or presentation contexts where the user wants the chat to dominate.
- Smaller laptop screens where 380 px floating + 412 px of board is cramped.

Giving users **both** modes (with one-click toggle between them) keeps the lightweight default while satisfying the "I just want to focus on this chat" workflow.

## Files that will change

- `src/pages/MessagesPage.tsx` — remove `grid-cols-3` layout split; introduce `chatView` state machine; mount the new shell components at page root; pass `anchorRef` from each row's chat button; wire Esc / click-outside / Shift-click-to-modal / auto-collapse-on-row-collapse; persist a `dockedRight` session preference.
- `src/components/SecureChat.tsx` — accept `onClose`, `onExpandToModal`, `onDock`, and `variant: 'floating' | 'docked' | 'modal'`; render a header with borrower + stage + channel selector + the matching action buttons; keep existing channel/conversation logic untouched.
- `src/components/FloatingChatPanel.tsx` *(new)* — fixed-positioned, animated, non-modal shell with anchor caret, Esc handler, optional click-outside detector, and dock/expand buttons. Wraps `SecureChat`.
- `src/components/ChatModalDialog.tsx` *(new)* — thin wrapper around shadcn `Dialog` rendering `SecureChat variant="modal"` at large size with the [Collapse to panel] action.

## Out of scope

- No changes to chat persistence, channels, or message rendering.
- No change to the row-level chat box / unread badge / active highlight already shipped.
- No change to the Inbox page or `SecureChat` business logic.

## Recommendation

Ship the **floating panel as default**, with **one-click expand to Modal Dialog** and an optional **right-edge dock**. This gives the user every close affordance, keeps chat visually tied to the originating row, and provides a fully focused dialog view when they want it.