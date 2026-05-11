import { z } from 'zod';

import { ApiClientError, apiRequest } from '@/lib/api';

export const authQueryKey = ['auth', 'current-user'] as const;

export const userRoleSchema = z.enum(['CUSTOMER', 'AGENT', 'MANAGER', 'ADMIN']);

export type UserRole = z.infer<typeof userRoleSchema>;

export const authUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  id: z.string().min(1),
  lastName: z.string().min(1),
  role: userRoleSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionSchema = z.object({
  user: authUserSchema,
});

export type AuthSession = z.infer<typeof authSessionSchema>;

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const getCurrentUser = async (signal?: AbortSignal) => {
  try {
    const response = await apiRequest<AuthUser>('/auth/me', {
      cache: 'no-store',
      signal,
    });
    return authUserSchema.parse(response);
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      (error.statusCode === 401 || error.statusCode === 403)
    ) {
      return null;
    }

    throw error;
  }
};

export const login = async (input: SignInInput) => {
  const response = await apiRequest<AuthSession>('/auth/login', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  return authSessionSchema.parse(response);
};

export const register = async (input: SignUpInput) => {
  const response = await apiRequest<AuthSession>('/auth/register', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  return authSessionSchema.parse(response);
};

export const logout = () =>
  apiRequest<void>('/auth/logout', {
    method: 'POST',
    parseAs: 'none',
  });
