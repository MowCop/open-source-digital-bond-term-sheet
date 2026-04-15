

## Why User Management Isn't Showing

The User Management page exists and is correctly routed, but it's **hidden from the sidebar** because the default logged-in user is James Miller (Syndicate Admin). The sidebar link has `adminOnly: true`, which requires `master_admin` role.

**Current behavior:** `useState<User>(mockUsers[1])` sets the default user to index 1 (James Miller, `syndicate_admin`). The nav item `{ path: '/admin', label: 'User Management', icon: Users, adminOnly: true }` is only rendered when `currentUser.role === 'master_admin'`.

### Fix

**`src/context/AppContext.tsx`** — Change the default user from `mockUsers[1]` to `mockUsers[0]` (Sarah Chen, `master_admin`) so the User Management link appears by default:

```
const [currentUser, setCurrentUser] = useState<User>(mockUsers[0]);
```

This single-line change makes the app default to a master admin user, making User Management visible in the sidebar immediately. Users can still switch roles via the user switcher at the bottom of the sidebar.

### Alternative (if non-admin users should also see it)

Remove `adminOnly: true` from the nav item in `AppLayout.tsx` and instead show a restricted-access message on the page itself (which already exists in `UserManagementPage.tsx`). This would let all users see the link but only master admins can use the page.

