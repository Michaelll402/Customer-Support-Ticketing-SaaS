import { describe, expect, it } from 'vitest';

import { validateApiEnv } from './env.validation';

const baseConfig = {
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5432/app?schema=public',
  JWT_SECRET: 'a-sufficiently-long-test-secret-value',
};

describe('validateApiEnv', () => {
  it('parses MINIO_USE_SSL="false" as the boolean false', () => {
    const result = validateApiEnv({ ...baseConfig, MINIO_USE_SSL: 'false' });

    expect(result.MINIO_USE_SSL).toBe(false);
  });

  it('parses MINIO_USE_SSL="true" as the boolean true', () => {
    const result = validateApiEnv({ ...baseConfig, MINIO_USE_SSL: 'true' });

    expect(result.MINIO_USE_SSL).toBe(true);
  });

  it('defaults MINIO_USE_SSL to false when it is absent', () => {
    const result = validateApiEnv({ ...baseConfig });

    expect(result.MINIO_USE_SSL).toBe(false);
  });

  it('rejects a non-boolean MINIO_USE_SSL string instead of silently coercing it', () => {
    expect(() =>
      validateApiEnv({ ...baseConfig, MINIO_USE_SSL: 'not-a-boolean' }),
    ).toThrow();
  });
});
