# Deal panel: actions to the top, hide the raw ID

## What changes

1. **Action bar moves to the top.** The row of buttons currently below the alert card — Deal Alert Data, Update History, Edit Latest, AI Extract, Delete — moves to the very top of the deal panel, in the strip that currently shows the long code (e.g. `cba0249b-02a5-4ab1-a388-2a81beaf71a9`). Button styling, order, and behaviour stay exactly as they are today (including the champagne AI Extract treatment and the right-aligned red Delete).
2. **The raw code is never shown.** That string is the alert sender's internal user ID, displayed as a fallback when the sender isn't found in the user list. It is replaced with the sender's name when known, and with a plain label such as "System" when unknown — the ID itself is never rendered.
3. Applies to both places the deal panel appears: the inline expanded row on the New Issue Board and the full-screen Focus Mode view.
4. The old bottom action bar is removed so the buttons appear only once, at the top.

## Technical notes

- All edits are in `src/pages/MessagesPage.tsx`, inside the `renderDealDetail` helper.
- The action-bar JSX (currently around the `history` panel and duplicated in the non-history branch) is lifted into a single toolbar rendered at the top of the panel, above the latest alert card, so both panel states show one consistent bar.
- The sender meta line that renders `getUserName(latest.senderId)` is where the ID leaks; `getUserName` currently falls back to the raw id. It will return a friendly fallback instead of the id, so no raw UUID can surface anywhere it is used (sender and recipient names).
