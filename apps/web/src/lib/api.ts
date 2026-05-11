import type { ApiErrorPayload } from '@customer-support/types';

import { webEnv } from '@/lib/env';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly payload?: ApiErrorPayload,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type ApiRequestOptions = RequestInit & {
  parseAs?: 'json' | 'none';
};

const buildApiUrl = (path: string) =>
  new URL(path, webEnv.NEXT_PUBLIC_API_BASE_URL);

const readErrorPayload = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return undefined;
  }

  return (await response.json()) as ApiErrorPayload;
};

export const apiRequest = async <T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const { headers, parseAs = 'json', ...init } = options;
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      ...(parseAs === 'json' ? { Accept: 'application/json' } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);

    throw new ApiClientError(
      payload?.message ?? 'Request failed.',
      response.status,
      payload,
    );
  }

  if (parseAs === 'none' || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const getApiErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong.',
) => {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('Non-API request error:', error);
  }

  return fallback;
};
