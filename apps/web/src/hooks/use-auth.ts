'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  authUserSchema,
  authQueryKey,
  getCurrentUser,
  login,
  logout,
  register,
} from '@/lib/auth';
import { ApiClientError } from '@/lib/api';
import { disconnectRealtime } from '@/lib/realtime-controller';

import type { QueryClient } from '@tanstack/react-query';

const isRoleSensitiveQueryKey = (queryKey: readonly unknown[]) =>
  queryKey[0] === 'tickets' || queryKey[0] === 'notifications';

const clearRoleSensitiveQueries = async (queryClient: QueryClient) => {
  await queryClient.cancelQueries({
    predicate: (query) => isRoleSensitiveQueryKey(query.queryKey),
  });

  queryClient.removeQueries({
    predicate: (query) => isRoleSensitiveQueryKey(query.queryKey),
  });
};

export const useCurrentUser = () =>
  useQuery({
    queryKey: authQueryKey,
    queryFn: ({ signal }) => getCurrentUser(signal),
    retry: (failureCount, error) => {
      if (
        error instanceof ApiClientError &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        return false;
      }

      return failureCount < 2;
    },
    staleTime: 60_000,
  });

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: async (session) => {
      await queryClient.cancelQueries({ queryKey: authQueryKey });
      await clearRoleSensitiveQueries(queryClient);

      queryClient.setQueryData(
        authQueryKey,
        authUserSchema.parse(session.user),
      );
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: register,
    onSuccess: async (session) => {
      await queryClient.cancelQueries({ queryKey: authQueryKey });
      await clearRoleSensitiveQueries(queryClient);

      queryClient.setQueryData(
        authQueryKey,
        authUserSchema.parse(session.user),
      );
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onMutate: async () => {
      disconnectRealtime();
      await queryClient.cancelQueries({ queryKey: authQueryKey });
      await clearRoleSensitiveQueries(queryClient);
    },
    onSuccess: () => {
      queryClient.setQueryData(authQueryKey, null);
      queryClient.removeQueries({
        predicate: (query) => isRoleSensitiveQueryKey(query.queryKey),
      });
    },
  });
};
