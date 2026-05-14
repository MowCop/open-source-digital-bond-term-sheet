## Goal

When an issue is duplicated by mistake on the New Issue Board, give the user a clearly-placed **Delete** button (with a confirmation dialog) that removes the duplicate deal and all its associated data — alert messages, deal chat lines (My Deal Chats), and the deal entry itself.

## Changes

### 1. Move the Delete button — `src/pages/MessagesPage.tsx`

- Remove the existing tiny hover-only trash icon next to the stage badge (around line 396–406).
- Add a new **Delete** button in the expanded action row that already contains *Deal Chat*, *Deal Alert Data*, and *Update History* (around line 413–447).
- Use `ml-auto` (or a flex spacer) so the Delete button sits flush to the **far right** of that row, on the same line as the other three buttons.
- Style it as `variant="destructive"` (or `outline` with destructive text) with a `Trash2` icon for clarity.

### 2. Replace native `confirm()` with a proper "Are you sure?" dialog

- Replace the `window.confirm(...)` in `handleDeleteThread` with the existing shadcn `AlertDialog` component (`AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`).
- Dialog copy:
  - Title: *"Delete this deal?"*
  - Description: *"This will permanently remove the deal `<borrower>`, its `<n>` alert(s), all related chat messages on My Deal Chats, the Deal Data entry, and any notifications. This action cannot be undone."*
  - Confirm button: *"Delete deal"* (destructive styling)
  - Cancel button: *"Cancel"*
- Track which group is pending deletion in local state (e.g. `pendingDelete: AlertGroup | null`) so the dialog can be a single instance at the page level.

### 3. Cascade deletion (verify — no new code expected)

The existing `deleteDeal` in `AppContext` already calls:
- `deleteMessagesContainingDeal(dealId)` — removes alert rows from **New Issue Board** (`messages` table)
- `deleteChatChannelsByDeal(dealId)` + `deleteChatMessagesByDeal(dealId)` — removes the **My Deal Chats** lines for that deal
- `deleteNotificationsByDeal(dealId)` — clears notifications
- `deleteDealRow(dealId)` — removes the **Deal Data** row

So calling `group.dealIds.forEach(id => deleteDeal(id))` in the confirmed-delete handler already satisfies the "duplicate chat lines and Deal Data must also be deleted" requirement. No backend or context changes needed.

### 4. Audit log

`deleteDeal` should already write an audit entry; if not, add one (`action: "deal.deleted"`, entity_id = dealId, details = borrower name) so the deletion is traceable per BondVDR's audit-everything rule.

## Out of scope

- No automatic duplicate-detection / merge logic. (Happy to add a follow-up that flags likely duplicates on the board if you want.)
- No changes to the My Deal Chats page itself — chat rows disappear automatically once their channel/messages are deleted.
- No DB schema or RLS changes.

## Open questions

1. Should the Delete button be visible to **all** users who can see the board, or only to `master_admin` + `syndicate_admin` (the same `canManageMessages` check that gates the existing trash icon)? Default assumption: **same as today — only users who can manage messages.**
2. Should I also add an automatic "possible duplicate" warning badge on the board when two deals share borrower + currency + size + pricing date, or leave duplicate detection to the user's eye for now? Default: **leave to the user.**
