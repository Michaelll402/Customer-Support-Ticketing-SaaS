import type { UserRole } from '@/lib/auth';

export const siteTitle = 'Support Workspace';

export const siteSubtitle =
  'Milestone 1 lean auth is active. Session truth comes from `/auth/me`, while ticket operations, reporting, and admin tooling remain deferred.';

export interface AppNavigationItem {
  description?: string;
  href: string;
  label: string;
}

const appRouteOrder = [
  '/dashboard',
  '/tickets',
  '/settings',
  '/profile',
] as const;

const appRouteDescriptions: Record<(typeof appRouteOrder)[number], string> = {
  '/dashboard':
    'Dashboard metrics and SLA reporting remain deferred to Milestone 5.',
  '/profile': 'Profile editing remains outside Milestone 1.',
  '/settings':
    'Admin configuration screens remain placeholder-only until Milestone 5.',
  '/tickets': 'Ticket workflows are deferred until Milestone 2.',
};

const appRouteLabelsByRole: Record<
  UserRole,
  Partial<Record<(typeof appRouteOrder)[number], string>>
> = {
  ADMIN: {
    '/dashboard': 'Dashboard',
    '/profile': 'Profile',
    '/settings': 'Settings',
    '/tickets': 'Ticket Queue',
  },
  AGENT: {
    '/profile': 'Profile',
    '/tickets': 'Ticket Queue',
  },
  CUSTOMER: {
    '/profile': 'Profile',
    '/tickets': 'My Tickets',
  },
  MANAGER: {
    '/dashboard': 'Dashboard',
    '/profile': 'Profile',
    '/tickets': 'My Queue',
  },
};

export const getAppShellItems = (role: UserRole): AppNavigationItem[] =>
  appRouteOrder
    .filter((path) => appRouteLabelsByRole[role][path])
    .map((path) => ({
      description: appRouteDescriptions[path],
      href: path,
      label: appRouteLabelsByRole[role][path]!,
    }));

export const getDefaultAppPath = (role: UserRole) => {
  switch (role) {
    case 'MANAGER':
    case 'ADMIN':
      return '/dashboard';
    case 'CUSTOMER':
    case 'AGENT':
    default:
      return '/tickets';
  }
};

export const canAccessAppPath = (role: UserRole, pathname: string) =>
  getAppShellItems(role).some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

export const formatRoleLabel = (role: UserRole) =>
  `${role.slice(0, 1)}${role.slice(1).toLowerCase()}`;
