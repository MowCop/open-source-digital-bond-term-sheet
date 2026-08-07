# Refactor role badge styling into a shared component

## Goal
Replace the scattered role-badge style logic in `ApprovedUsersSection`, `UserManagementPage`, and `AdminPage` with a single, reusable `RoleBadge` component so that future role color changes only need to be edited in one place.

## Current state
- `src/components/ApprovedUsersSection.tsx` — hardcoded `Badge` className that checks `.includes('admin')` and manually applies `bg-secondary` / `hover:text-white` / focus states.
- `src/pages/UserManagementPage.tsx` — inline ternary selecting `Badge` variant (`default` / `secondary` / `outline`) per role.
- `src/pages/AdminPage.tsx` — local `roleBadge` mapping of role → variant + label, used only inside that page.
- `src/components/ui/badge.tsx` — shadcn `badgeVariants` already defines `default`, `secondary`, `outline`, `destructive` variants, but no role-specific semantics.

## Proposed changes

### 1. Create `src/components/RoleBadge.tsx`
A small wrapper around `Badge` that accepts a `role: UserRole` (or a raw string role) and resolves the correct visual style and label.

```text
Props:
  role: string        -- e.g. 'master_admin', 'syndicate_admin', 'syndicate_readonly'
  label?: string     -- optional override label
  className?: string -- optional extra classes
```

It will expose a central mapping:

```text
master_admin      -> default variant (primary/gold)
syndicate_admin   -> secondary variant with forced muted-blue bg,
                     white text, and hover/focus states
all read-only & vendor roles -> outline variant
```

The component will also expose the label mapping so callers do not need to repeat `roleLabels` / `ALL_ROLES`.

### 2. Add theme tokens to `src/index.css` (optional)
If the existing `bg-secondary` / `text-secondary-foreground` tokens are not precise enough for the Syndicate Admin treatment, add two semantic utility tokens:

```text
--role-admin-bg
--role-admin-fg
--role-admin-hover-bg
```

Then have `RoleBadge` use those CSS variables via `bg-[hsl(var(--role-admin-bg))]` or a dedicated utility class. This keeps colors in one place and makes dark/light themes easier.

### 3. Replace existing inline badge logic
- `ApprovedUsersSection.tsx` — replace the manual `Badge` block with `<RoleBadge role={roleByUser[p.user_id]} />`.
- `UserManagementPage.tsx` — replace the inline ternary `Badge` in the Address Book table with `<RoleBadge role={u.role} />`.
- `AdminPage.tsx` — replace the `roleBadge` mapping and inline `Badge variant={...}` calls with `<RoleBadge role={user.role} />`.

### 4. Cleanup
- Remove unused `roleBadge` mapping from `AdminPage.tsx`.
- Remove duplicate `roleLabels` usage where `RoleBadge` now supplies the label.
- Run typecheck and lint to ensure no broken references.

## Out of scope
- No database or role-permission changes.
- No UI behavior changes beyond making badge colors consistent and hover/focus states uniform.

## Verification
- `tsgo` passes.
- User role badges in Address Book, Approved Users, and Admin page still show the correct labels and colors (Syndicate Admin = muted blue with white text on hover/focus).
