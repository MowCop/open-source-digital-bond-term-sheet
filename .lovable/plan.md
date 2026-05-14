# Syndicate Admins: see all users in Address Book

## Problem

Today, Address Book & User Admin filters users by organisation when the viewer is a Syndicate Admin. EBM (a Syndicate Admin) only sees users whose `organization` or `createdByOrg` matches "EBM", so users created by other Syndicate Admin orgs (e.g. another bank) are invisible. They cannot be selected for chat or added to distribution lists.

Note: Syndicate – Read Only users are already unscoped (the current code only restricts when `isSyndicateAdmin === true`), so this change brings Syndicate Admin in line with both Read Only and Master Admin.

## Change

Make user visibility identical to Master Admin for all syndicate-side roles. Deals, distribution lists, messages, and audit log scoping stay exactly as they are — only the user roster opens up.

### Edit
- `src/lib/scoping.ts` → `scopeUsers()`: remove the org filter so Syndicate Admins see every user. Guests still see none.

### Result
- EBM (Syndicate Admin) now sees every user in Address Book, including those created by other Syndicate Admin orgs, matching the Master Admin view.
- Those users become selectable in distribution list builders and chat participant pickers (which already read from the same scoped `users` list).
- No changes to who can edit, delete, or invite users — Master Admin still owns those actions where the existing UI restricts them.

## Out of scope
- No changes to deal scoping (Syndicate Admins still only see their own deals + bookrunner deals).
- No changes to distribution list ownership scoping.
- No DB / RLS changes — `users` table RLS already lets any admin read.
