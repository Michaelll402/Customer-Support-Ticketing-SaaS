import type { UserRole } from '@/lib/auth';
import { appRoutePaths, type AppRoutePath } from '@/lib/app-access';

export const siteTitle = 'Support Workspace';

export const siteSubtitle =
  'Lean auth remains the session foundation, and Milestone 2 now includes the ticket list, customer ticket creation, and metadata-only ticket detail. Conversation and later workflow slices remain deferred.';

export interface AppNavigationItem {
  description?: string;
  href: AppRoutePath;
  label: string;
}

const appRouteDescriptions: Record<AppRoutePath, string> = {
  '/dashboard':
    'Dashboard metrics and SLA reporting remain deferred to Milestone 5.',
  '/profile': 'Profile editing remains outside Milestone 1.',
  '/settings':
    'Admin configuration screens remain placeholder-only until Milestone 5.',
  '/tickets':
    'Ticket list, filters, sorting, pagination, customer ticket creation, and metadata-only ticket detail are live in Milestone 2. Conversation stays deferred to Milestone 3.',
};

const appRouteLabelsByRole: Record<
  UserRole,
  Partial<Record<AppRoutePath, string>>
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
  appRoutePaths
    .filter((path) => appRouteLabelsByRole[role][path])
    .map((path) => ({
      description: appRouteDescriptions[path],
      href: path,
      label: appRouteLabelsByRole[role][path]!,
    }));

export const formatRoleLabel = (role: UserRole) =>
  `${role.slice(0, 1)}${role.slice(1).toLowerCase()}`;
