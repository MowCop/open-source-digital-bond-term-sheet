# Send update: one "Terms" text covering the whole deal

## What you will see
- The **Your intro** box is removed.
- **Your notes below the terms** becomes **Terms**.
- When the dialog opens, Terms is filled in straight away with a short bulletin that covers the whole deal: the borrower, then one line per tranche (currency, amount, tenor, fixed/floating, status) and the shared terms (bookrunners, governing law, settlement, listing). This text comes from the saved term sheet; no AI is used.
- You can edit, add or remove text by hand.
- A **Polish with AI** button rewrites the text in investor-announcement style using the existing bulletin AI. It never adds terms that aren't in the saved term sheet, and you still review the result.
- **Regenerate from terms** rebuilds the text from the latest saved term sheet.
- If the saved terms change after you've written or edited the text, a warning shows "Terms text may be out of date". Send stays blocked until you click Regenerate or tick "Text checked against current terms".
- The automatic term table and the legal notices stay in the email below the Terms text, as now.

## Technical details
- `src/lib/newIssueAlerts.ts`: add a pure `dealTermsText(state, workspace, borrower)` that builds the whole-deal text from the main BDT state plus `trancheBdtState` for each tranche. `renderBulletin` drops `intro` and renders `notes` (now the Terms text), then the table, then legal notices. Tests cover a 5-tranche deal naming all tranches, and a single-tranche deal.
- `SendUpdateDialog.tsx`: remove the intro field and rename the notes field. Store the edited Terms text plus the `termsHash` it was based on in `deal_bulletin_notes` (existing `notes`; hash kept beside the legal-notice marker, so no schema change). A changed hash shows the stale warning and gates approval.
- Polish calls `generate-bulletin-from-deal` with `editedBulletin` = the current Terms text (the existing pattern), using the chosen AI model. The output replaces the box only after you confirm.
- The existing `intro` column is no longer shown. Old intro text is added to the front of Terms once, so nothing is lost.
- Update the alert tests and the AGENTS.md alerts rule to describe the one editable Terms text.
