import { userRoleLabels, type UserRole } from '@/lib/admin-users';

// Restrained, role-semantic colors — admin carries the most weight, customer
// the least. Rings keep the lighter badges legible on white.
const roleClasses: Record<UserRole, string> = {
  ADMIN: 'bg-slate-900 text-white',
  MANAGER: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  AGENT: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  CUSTOMER: 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200',
};

export const RoleBadge = ({ role }: { role: UserRole }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleClasses[role]}`}
  >
    {userRoleLabels[role]}
  </span>
);

export const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      isActive
        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
        : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
    }`}
  >
    <span
      aria-hidden="true"
      className={`h-1.5 w-1.5 rounded-full ${
        isActive ? 'bg-emerald-500' : 'bg-slate-400'
      }`}
    />
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

const avatarTone: Record<UserRole, string> = {
  ADMIN: 'bg-slate-900 text-white',
  MANAGER: 'bg-sky-600 text-white',
  AGENT: 'bg-slate-200 text-slate-700',
  CUSTOMER: 'bg-slate-100 text-slate-500',
};

const initials = (firstName: string, lastName: string) =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

/**
 * Identity avatar tinted by role so people are scannable at a glance. Decorative
 * (the name sits beside it), so it is hidden from assistive tech.
 */
export const UserAvatar = ({
  firstName,
  lastName,
  role,
  size = 'md',
}: {
  firstName: string;
  lastName: string;
  role: UserRole;
  size?: 'md' | 'lg';
}) => (
  <span
    aria-hidden="true"
    className={`inline-flex flex-none items-center justify-center rounded-full font-semibold ${
      size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs'
    } ${avatarTone[role]}`}
  >
    {initials(firstName, lastName)}
  </span>
);
