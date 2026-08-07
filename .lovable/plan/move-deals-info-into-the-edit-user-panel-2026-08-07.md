# Move Deals info into the Edit User panel

## What changes

**Address Book table**
- Remove the "Deals" column (header + cell) and its hover popover from the contacts table. The row becomes: Name & Contact / Organization / Role / Login Activity / Created Details / Actions.

**Edit User dialog**
- Add an "Authorised Deals" section directly above the existing "Deal Chats — invited" block, showing the same content the popover used to show:
  - Header row with total count and a sub-line: "X active (manage/edit) · Y passive (read-only)".
  - Two grouped lists — "Active — manage & edit" (green label) and "Passive — read only" (white label) — each with a count badge and "None" when empty.
  - Each deal row: issuer name, `CCY size · tenor · coupon`, stage badge, and "Created by <org>" when present.
  - Scrollable (max height) so the dialog stays a sensible size.
- Read-only display; deal access is not editable from this dialog.

## Technical notes

All changes are in `src/pages/UserManagementPage.tsx`:
- Delete the `<TableHead>Deals</TableHead>` and the corresponding `<TableCell>` containing the `Popover`.
- Reuse the existing `dealsForUser` / `splitDealsForUser` helpers, called with `editingUser` inside the dialog.
- Remove the now-unused `Popover` imports if nothing else in the file uses them.
- Dialog content already has `space-y-5`; the new block matches the border/rounded styling of the Deal Chats block for visual consistency.
