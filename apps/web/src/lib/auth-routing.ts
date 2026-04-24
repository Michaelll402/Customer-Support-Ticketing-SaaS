import type { UserRole } from '@/lib/auth';
import { canAccessAppPath, getDefaultAppPath } from '@/lib/app-access';

export const getPostAuthRedirectPath = (
  role: UserRole,
  nextPath: string | null,
) => {
  if (
    nextPath &&
    nextPath.startsWith('/') &&
    canAccessAppPath(role, nextPath)
  ) {
    return nextPath;
  }

  return getDefaultAppPath(role);
};

export const getSignInRedirectPath = (pathname: string) =>
  `/sign-in?next=${encodeURIComponent(pathname)}`;
