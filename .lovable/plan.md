## Problem

Creating a new issue from "Create New Issue" silently fails on both **Save Draft** and **Save & Send**. The console shows:

```
[Cloud] insertMessage failed
code: "42501"
message: new row violates row-level security policy for table "messages"
```

### Root cause

The `messages` table RLS insert policy is:

```sql
sender_id = auth.uid()::text
```

But in `AIDraftPage.tsx` we pass `senderId: currentUser.id`, where `currentUser` comes from the legacy mock-user store (`bondvdr.currentUser` in localStorage, seeded from `mockUsers[0]`). Its `id` is something like `"u1"` — not the Supabase auth UUID — so the RLS check fails and the row is rejected. The optimistic local state shows the draft briefly, but it is never persisted, and on reload it disappears. "Save & Send" hits the same insert and fails the same way.

Audit-log inserts succeed because that policy has an `OR is_admin(auth.uid())` branch; the `messages` policy does not.

## Fix

Use the real Supabase auth user id as `sender_id` on insert.

### Changes

1. **`src/context/AppContext.tsx`** — in `createMessage`, resolve the effective sender id from the Supabase session (via `useAuth().authUser?.id`) and use it for both the persisted `senderId` and the audit entry. Fall back to `currentUser.id` only when no auth user exists (keeps mock-mode unit tests working).

2. **`src/pages/AIDraftPage.tsx`** — no longer pass `senderId: currentUser.id`; let `createMessage` set it, OR pass `authUser?.id ?? currentUser.id`. Pick whichever keeps the type contract cleanest (likely: keep the prop but source it from `authUser`).

3. **Toast on failure** — `insertMessage(...).catch(...)` currently only `console.error`s, so the UI shows "Draft Saved" even when the DB insert was rejected. Surface a destructive toast ("Could not save draft — please retry") so the user is not misled. Same treatment for `sendMessage`.

4. **Apply the same `auth.uid()` fix to other inserts blocked by analogous policies**, specifically `sendChatMessage` (chat_messages policy: `sender_id = auth.uid()::text`). Audit, deals, notifications, etc. all have admin-OR branches and are unaffected.

### Not changing

- RLS policies remain as-is — they are correct; the bug is on the client.
- The mock-user concept stays for display (name, organization, role badges); only the persisted `sender_id` switches to the auth UUID.

### Verification

- Drop the Aldar PDF, click **Save Draft** → no RLS error in console, row appears in `messages` table with `sender_id = <auth uid>`.
- Click **Save & Send** → row updates to `status='sent'`, recipients populated, no console error.
- Reload the page → the new draft/sent message is still in the Messages list (proves it persisted, not just local optimistic state).
