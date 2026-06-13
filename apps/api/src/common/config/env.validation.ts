import { parseEnv, z } from '@customer-support/config';

/**
 * Parses an environment boolean robustly.
 *
 * `z.coerce.boolean()` uses JavaScript truthiness, so the string `"false"` is
 * coerced to `true`. This helper only accepts the literal strings `"true"` and
 * `"false"` (or real booleans), defaults when the value is absent, and rejects
 * any other value instead of silently producing the wrong boolean.
 */
const envBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(defaultValue)
    .transform((value) =>
      typeof value === 'boolean' ? value : value === 'true',
    );

export const apiEnvSchema = z.object({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  AUTH_COOKIE_NAME: z.string().min(1).default('access_token'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(28800),
  JWT_SECRET: z.string().min(1),
  MINIO_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  MINIO_BUCKET: z.string().min(1).default('attachments'),
  MINIO_ENDPOINT: z.string().min(1).default('localhost'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_SECRET_KEY: z.string().min(1).default('minioadmin'),
  MINIO_USE_SSL: envBoolean(false),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  QUEUE_REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  SWAGGER_PATH: z.string().min(1).default('api'),
  WEB_APP_ORIGIN: z.string().url().default('http://localhost:3000'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const validateApiEnv = (config: Record<string, unknown>) =>
  parseEnv(apiEnvSchema, config);
