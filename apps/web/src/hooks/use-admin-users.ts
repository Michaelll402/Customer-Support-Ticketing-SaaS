'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  changeAdminUserRole,
  createAdminUser,
  getAdminUsers,
  getAdminUserStats,
  revokeAdminUserSessions,
  setAdminUserStatus,
  updateAdminUserProfile,
  updateAdminUserTeams,
  type AdminUser,
  type AdminUserListQuery,
  type AdminUserListResponse,
  type AdminUserStats,
  type CreateUserFormInput,
  type UserRole,
} from '@/lib/admin-users';

const invalidateAdmin = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
    // Every admin mutation writes an audit row.
    queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] }),
  ]);

export const useAdminUsers = (query: AdminUserListQuery, enabled = true) =>
  useQuery<AdminUserListResponse>({
    enabled,
    queryKey: ['admin', 'users', 'list', query],
    queryFn: () => getAdminUsers(query),
    placeholderData: keepPreviousData,
  });

// Workspace-wide counts for the summary strip. Shares the ['admin','users']
// prefix, so any admin mutation invalidates and refreshes it automatically.
export const useAdminUserStats = (enabled = true) =>
  useQuery<AdminUserStats>({
    enabled,
    queryKey: ['admin', 'users', 'stats'],
    queryFn: getAdminUserStats,
    staleTime: 30_000,
  });

export const useCreateAdminUser = () => {
  const queryClient = useQueryClient();
  return useMutation<AdminUser, Error, CreateUserFormInput>({
    mutationFn: (input) => createAdminUser(input),
    onSuccess: () => invalidateAdmin(queryClient),
  });
};

export const useUpdateAdminUserProfile = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation<AdminUser, Error, { firstName: string; lastName: string }>(
    {
      mutationFn: (input) => updateAdminUserProfile(id, input),
      onSuccess: () => invalidateAdmin(queryClient),
    },
  );
};

export const useChangeAdminUserRole = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation<AdminUser, Error, UserRole>({
    mutationFn: (role) => changeAdminUserRole(id, role),
    onSuccess: () => invalidateAdmin(queryClient),
  });
};

export const useSetAdminUserStatus = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation<AdminUser, Error, boolean>({
    mutationFn: (isActive) => setAdminUserStatus(id, isActive),
    onSuccess: () => invalidateAdmin(queryClient),
  });
};

export const useUpdateAdminUserTeams = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation<AdminUser, Error, string[]>({
    mutationFn: (teamIds) => updateAdminUserTeams(id, teamIds),
    onSuccess: () => invalidateAdmin(queryClient),
  });
};

export const useRevokeAdminUserSessions = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation<AdminUser, Error, void>({
    mutationFn: () => revokeAdminUserSessions(id),
    onSuccess: () => invalidateAdmin(queryClient),
  });
};
