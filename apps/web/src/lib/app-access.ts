import type { UserRole } from '@/lib/auth';

export const appRoutePaths = [
  '/dashboard',
  '/tickets',
  '/tickets/trash',
  '/settings',
  '/profile',
] as const;

export type AppRoutePath = (typeof appRoutePaths)[number];

const roleAccessPrefixes: Record<UserRole, readonly string[]> = {
  ADMIN: ['/dashboard', '/tickets', '/settings', '/profile'],
  AGENT: ['/tickets', '/profile'],
  CUSTOMER: ['/tickets', '/profile'],
  MANAGER: ['/dashboard', '/tickets', '/profile'],
};

const matchesPathPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const getAllowedAppPathPrefixes = (role: UserRole) =>
  roleAccessPrefixes[role];

export const canAccessAppPath = (role: UserRole, pathname: string) =>
  getAllowedAppPathPrefixes(role).some((prefix) =>
    matchesPathPrefix(pathname, prefix),
  );

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
