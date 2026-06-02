# Move Syndicate Chat Participants into the chat strip

## What changes

1. **`DraftChatStrip.tsx`** — add a collapsible "Participants (N)" sub-section inside the strip (collapsed by default). When expanded it shows:
   - The chip list of currently-added SCPs with × to remove.
   - The search input (`Type a name, bank, or email…`) with the same popover dropdown of matching Syndicate users.
   - No helper text.
   - The component takes new props: `onAddScp(id)`, `onRemoveScp(id)`, and the eligible-users source (reuse logic by lifting `users` from `useApp()` and filtering to `syndicate_admin` / `master_admin` roles, matching the existing `scpMatches` logic in `AIDraftPage`).
   - The existing one-line chip strip showing participants below the header is removed (replaced by this sub-section) to avoid duplication.

2. **`AIDraftPage.tsx`** —
   - Delete the entire right-rail "Syndicate Chat Participants" card (lines ~840–899).
   - Remove now-unused locals tied only to that card: `scpQuery`, `scpMatches`, `q`, and the `MessageSquare`/`X` imports if no longer referenced elsewhere on the page. Keep `scpIds`, `setScpIds`, `toggleScp` — they're still used by the chat strip and by `createDeal`/notifications.
   - Pass `toggleScp` (or split add/remove handlers) and the eligible-user list down to `<DraftChatStrip />`.
   - Recipients card naturally reflows into the freed vertical space — no extra layout work.

3. **No changes** to `AppContext`, `cloudData`, types, or backend. Behaviour (auto-add to chat, notifications, headline mirroring) is unchanged — only the UI location moves.

## Technical notes

- The collapsible uses local `useState` (default `false`); not persisted — it's a transient editing affordance, distinct from the strip's own open/close which stays in `localStorage`.
- Eligible users filter mirrors the current `AIDraftPage` rule (Syndicate users only, excluding the current user already present as creator).
- Participant count badge in the strip header continues to read `scpIds.length + 1` (creator) as today.

## Out of scope

- No changes to chat persistence, headline mirroring, AI extraction, or the Recipients picker.
