import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/bond';

export const ROLE_LABELS: Record<UserRole, string> = {
  master_admin: 'Master Admin',
  syndicate_admin: 'Syndicate Admin',
  vendor_user: 'Read Only',
  syndicate_readonly: 'Syndicate – Read Only',
  sales_readonly: 'Sales – Read Only',
  guest_readonly: 'Guest Read Only',
};

const ALL_ROLES: UserRole[] = [
  'master_admin',
  'syndicate_admin',
  'vendor_user',
  'syndicate_readonly',
  'sales_readonly',
  'guest_readonly',
];

function normalizeRole(role: string): UserRole {
  return ALL_ROLES.includes(role as UserRole) ? (role as UserRole) : 'syndicate_readonly';
}

interface RoleBadgeProps {
  role: string;
  label?: string;
  className?: string;
}

export function RoleBadge({ role, label, className }: RoleBadgeProps) {
  const normalized = normalizeRole(role);
  const displayLabel = label ?? ROLE_LABELS[normalized];

  if (normalized === 'master_admin') {
    return <Badge variant="default" className={cn('border-transparent', className)}>{displayLabel}</Badge>;
  }

  if (normalized === 'syndicate_admin') {
    return (
      <Badge
        variant="secondary"
        className={cn(
          'bg-secondary text-white hover:bg-secondary hover:text-white focus:bg-secondary focus:text-white focus:outline-none border-transparent',
          className
        )}
      >
        {displayLabel}
      </Badge>
    );
  }

  return <Badge variant="outline" className={cn('hover:bg-muted focus:bg-muted focus:outline-none', className)}>{displayLabel}</Badge>;
}

export default RoleBadge;
