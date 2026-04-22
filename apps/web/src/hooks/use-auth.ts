'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  authQueryKey,
  getCurrentUser,
  login,
  logout,
  register,
} from '@/lib/auth';

export const useCurrentUser = () =>
  useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      queryClient.setQueryData(authQueryKey, session.user);
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: register,
    onSuccess: (session) => {
      queryClient.setQueryData(authQueryKey, session.user);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authQueryKey, null);
    },
  });
};
