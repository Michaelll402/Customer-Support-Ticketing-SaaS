import type { AppShellItem } from '@customer-support/ui';

export const siteTitle = 'Support Workspace';

export const siteSubtitle =
  'Milestone 0 foundation only. Navigation, providers, and layout are in place while auth and business workflows remain intentionally deferred.';

export const appShellItems: AppShellItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Management and SLA views will land in Milestone 5.',
  },
  {
    href: '/tickets',
    label: 'Tickets',
    description: 'Ticket list and detail workflows begin in Milestone 2.',
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Admin controls are deferred to Milestone 5.',
  },
  {
    href: '/profile',
    label: 'Profile',
    description: 'User profile scaffolding only in Milestone 0.',
  },
];
