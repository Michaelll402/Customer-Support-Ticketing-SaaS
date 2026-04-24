'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { type UserRole } from '@/lib/auth';
import { getPostAuthRedirectPath } from '@/lib/auth-routing';
import { useCurrentUser } from '@/hooks/use-auth';

export const useAuthPageSession = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUserQuery = useCurrentUser();
  const nextPath = searchParams.get('next');

  useEffect(() => {
    if (!currentUserQuery.data) {
      return;
    }

    router.replace(
      getPostAuthRedirectPath(currentUserQuery.data.role, nextPath),
    );
  }, [currentUserQuery.data, nextPath, router]);

  const resolvePostAuthPath = (role: UserRole) =>
    getPostAuthRedirectPath(role, nextPath);

  return {
    currentUserQuery,
    resolvePostAuthPath,
  };
};
