import type { UserRole } from '@/lib/auth';
import { appRoutePaths, type AppRoutePath } from '@/lib/app-access';

export const siteTitle = 'Support Workspace';

export const siteSubtitle =
  'Ticket lists, customer ticket creation, conversation threads, internal notes, attachments, staff workflow controls, in-app notifications, and realtime updates are available. SLA, dashboards, and admin CRUD remain deferred.';

export interface AppNavigationItem {
  description?: string;
  href: AppRoutePath;
  label: string;
}

const appRouteDescriptions: Record<AppRoutePath, string> = {
  '/dashboard':
    'Dashboard metrics and SLA reporting remain deferred to Milestone 5.',
  '/profile': 'Profile editing remains deferred.',
  '/settings':
    'Admin configuration screens remain placeholder-only until Milestone 5.',
  '/tickets':
    'Ticket list, filters, sorting, pagination, customer ticket creation, conversation, notes, attachments, staff workflow controls, in-app notifications, and realtime invalidation are available.',
  '/tickets/trash':
    'Admin-only trash: review soft-deleted tickets and restore them with their full conversation, workflow, and SLA history intact.',
  '/assignment-requests':
    'Manager/admin review queue for agent reassignment requests: approve to apply the change or decline to keep the current assignee.',
  '/settings/users':
    'Admin user management: create accounts, change roles and team membership, deactivate/activate, and revoke sessions.',
  '/settings/audit':
    'Admin audit log: a newest-first, filterable record of administrative and workflow actions for traceability.',
};

const appRouteLabelsByRole: Record<
  UserRole,
  Partial<Record<AppRoutePath, string>>
> = {
  ADMIN: {
    '/dashboard': 'Dashboard',
    '/profile': 'Profile',
    '/tickets': 'Ticket Queue',
    '/tickets/trash': 'Trash',
    '/assignment-requests': 'Assignment requests',
    '/settings/users': 'Users',
    '/settings/audit': 'Audit log',
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
    '/assignment-requests': 'Assignment requests',
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
