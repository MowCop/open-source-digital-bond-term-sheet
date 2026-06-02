In `src/components/AlertHistoryCard.tsx`, disable the **Retract** button when the alert is Pre-Published (i.e. `message.status === 'draft'`).

- Keep the button visible so users see it exists, but render it greyed out and non-interactive: add `disabled` and a `title` tooltip explaining "Retract is only available for Published alerts".
- The existing condition `(isSent || isDraft) && !isRetracted` stays, but for the draft case the button becomes disabled rather than active.
- No changes to Send, Edit, Delete, or any other component. No state/logic changes elsewhere.