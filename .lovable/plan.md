## What is happening

The published site is updated, but the screenshot shows a different user context from the editor preview:

- Published site opens on the public authentication screen unless you log in.
- After login, the New Issue Board is scoped by the authenticated user’s role and organisation.
- The board currently builds rows from `messages`, then looks up linked `deals` for borrower/bookrunner/stage data.
- For syndicate users, the app applies extra client-side organisation scoping to deals, but not consistently to the message rows themselves. That can leave rows visible while their linked deal data is hidden or incomplete, so the public view can show different borrower/headline/bookrunner detail than the project/editor session.

This is not a stale-publish problem anymore; it is an authentication/scoping/data-context problem.

## Correction plan

1. **Align New Issue Board rows with deal visibility**
   - Update the board data grouping so a user only sees message threads whose linked deal is visible to their current role/org scope.
   - Prevent “orphan” message rows where the message is visible but the linked deal details are not.
   - Keep Master Admin able to see all rows.

2. **Make the board’s displayed data deterministic**
   - Keep borrower, stage, and bookrunners sourced from the linked deal when present.
   - Add a safe fallback only when a message genuinely has no linked deal.
   - This avoids different published/editor text caused by missing scoped deal joins.

3. **Fix saved deal ownership for new issues if needed**
   - Confirm new deals created from `Create New Issue` are tagged with the authenticated user’s organisation.
   - If not, ensure the `createdByOrg` value follows the logged-in profile organisation, so newly created issues appear consistently after reload/publish/login.

4. **Validate against the live backend data**
   - Check with the current seeded/live rows: Lithuania, United States, Thailand, Eurofima, Greenland, Revolut, Apple, etc.
   - Verify Master Admin sees the full board.
   - Verify a Syndicate Admin sees only their organisation’s created/bookrunner deals and no incomplete/orphan rows.

## Expected result

After implementation and republishing, the public site and editor preview will show the same New Issue Board content for the same logged-in user. Different users may still see different rows by design, because access is role/organisation based.