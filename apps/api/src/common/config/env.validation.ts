import { parseEnv, z } from '@customer-support/config';

export const apiEnvSchema = z.object({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  MINIO_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  MINIO_BUCKET: z.string().min(1).default('attachments'),
  MINIO_ENDPOINT: z.string().min(1).default('localhost'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_SECRET_KEY: z.string().min(1).default('minioadmin'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  QUEUE_REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  SWAGGER_PATH: z.string().min(1).default('api'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const validateApiEnv = (config: Record<string, unknown>) =>
  parseEnv(apiEnvSchema, config);
