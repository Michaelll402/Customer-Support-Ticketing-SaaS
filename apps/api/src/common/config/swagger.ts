/**
 * Swagger exposes the full API surface and DTO shapes, so it must not be served
 * in production. It remains available in development and test where it is a
 * useful exploration tool.
 */
export const shouldExposeSwagger = (env: string): boolean =>
  env !== 'production';
