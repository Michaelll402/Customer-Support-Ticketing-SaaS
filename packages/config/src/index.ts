import { z, type ZodError, type ZodTypeAny } from 'zod';

const normalizeIssuePath = (path: (string | number)[]) => {
  if (path.length === 0) {
    return 'root';
  }

  return path.join('.');
};

export const formatZodError = (error: ZodError) =>
  error.issues
    .map((issue) => `${normalizeIssuePath(issue.path)}: ${issue.message}`)
    .join('; ');

export const parseEnv = <TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: Record<string, unknown>,
): z.infer<TSchema> => {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(`Environment validation failed: ${formatZodError(result.error)}`);
  }

  return result.data;
};

export { z };
