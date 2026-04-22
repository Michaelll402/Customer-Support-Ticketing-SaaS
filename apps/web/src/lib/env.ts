import { parseEnv, z } from '@customer-support/config';

const webEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_APP_NAME: z
    .string()
    .min(1)
    .default('Customer Support Ticketing SaaS'),
});

export const webEnv = parseEnv(webEnvSchema, {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});
