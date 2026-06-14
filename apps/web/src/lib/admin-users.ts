import { z } from 'zod';

import { apiRequest } from '@/lib/api';

export const userRoleSchema = z.enum(['CUSTOMER', 'AGENT', 'MANAGER', 'ADMIN']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userRoleLabels: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  AGENT: 'Agent',
  CUSTOMER: 'Customer',
};

const adminUserTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const adminUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: userRoleSchema,
  isActive: z.boolean(),
  teams: z.array(adminUserTeamSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

const listMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const adminUserListResponseSchema = z.object({
  items: z.array(adminUserSchema),
  meta: listMetaSchema,
  activeAdminCount: z.number().int().optional(),
});

export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;

export const ADMIN_PASSWORD_MIN = 8;

export const createUserFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  password: z
    .string()
    .min(ADMIN_PASSWORD_MIN, `Use at least ${ADMIN_PASSWORD_MIN} characters.`)
    .max(128),
  role: userRoleSchema,
  teamIds: z.array(z.string().min(1)),
});

export type CreateUserFormInput = z.infer<typeof createUserFormSchema>;

export const editUserFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  role: userRoleSchema,
  teamIds: z.array(z.string().min(1)),
});

export type EditUserFormInput = z.infer<typeof editUserFormSchema>;

export interface AdminUserListQuery {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

const buildUserListParams = (query: AdminUserListQuery) => {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.role) params.set('role', query.role);
  if (query.isActive !== undefined)
    params.set('isActive', String(query.isActive));
  return params;
};

export const getAdminUsers = async (query: AdminUserListQuery) => {
  const response = await apiRequest<AdminUserListResponse>(
    `/admin/users?${buildUserListParams(query).toString()}`,
    { cache: 'no-store' },
  );
  return adminUserListResponseSchema.parse(response);
};

export const createAdminUser = async (input: CreateUserFormInput) => {
  const response = await apiRequest<AdminUser>('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  return adminUserSchema.parse(response);
};

export const updateAdminUserProfile = async (
  id: string,
  input: { firstName: string; lastName: string },
) => {
  const response = await apiRequest<AdminUser>(`/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  return adminUserSchema.parse(response);
};

export const changeAdminUserRole = async (id: string, role: UserRole) => {
  const response = await apiRequest<AdminUser>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
    cache: 'no-store',
  });
  return adminUserSchema.parse(response);
};

export const setAdminUserStatus = async (id: string, isActive: boolean) => {
  const response = await apiRequest<AdminUser>(`/admin/users/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
    cache: 'no-store',
  });
  return adminUserSchema.parse(response);
};

export const updateAdminUserTeams = async (id: string, teamIds: string[]) => {
  const response = await apiRequest<AdminUser>(`/admin/users/${id}/teams`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamIds }),
    cache: 'no-store',
  });
  return adminUserSchema.parse(response);
};

export const revokeAdminUserSessions = async (id: string) => {
  const response = await apiRequest<AdminUser>(
    `/admin/users/${id}/revoke-sessions`,
    { method: 'POST', cache: 'no-store' },
  );
  return adminUserSchema.parse(response);
};

export interface AdminUserStats {
  total: number;
  active: number;
  inactive: number;
  agents: number;
  managers: number;
  admins: number;
}

/**
 * Accurate, workspace-wide counts for the summary strip. Each segment is a
 * filtered list query with `limit: 1`, read from `meta.totalItems` — so the
 * numbers reflect the whole directory, not just the current page. Uses only the
 * existing list endpoint (no extra backend surface).
 */
export const getAdminUserStats = async (): Promise<AdminUserStats> => {
  const countOf = async (filters: Partial<AdminUserListQuery>) => {
    const response = await getAdminUsers({ page: 1, limit: 1, ...filters });
    return response.meta.totalItems;
  };
  const [total, active, agents, managers, admins] = await Promise.all([
    countOf({}),
    countOf({ isActive: true }),
    countOf({ role: 'AGENT' }),
    countOf({ role: 'MANAGER' }),
    countOf({ role: 'ADMIN' }),
  ]);
  return {
    total,
    active,
    inactive: Math.max(total - active, 0),
    agents,
    managers,
    admins,
  };
};
