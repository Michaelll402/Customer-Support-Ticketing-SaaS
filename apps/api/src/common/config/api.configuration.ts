import { validateApiEnv } from './env.validation';

export const apiConfiguration = () => {
  const env = validateApiEnv(process.env);

  return {
    app: {
      env: env.NODE_ENV,
      host: env.API_HOST,
      port: env.API_PORT,
      swaggerPath: env.SWAGGER_PATH,
      webOrigin: env.WEB_APP_ORIGIN,
    },
    auth: {
      accessTokenTtlSeconds: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
      cookieName: env.AUTH_COOKIE_NAME,
      jwtSecret: env.JWT_SECRET,
    },
    database: {
      url: env.DATABASE_URL,
    },
    queue: {
      redisUrl: env.QUEUE_REDIS_URL,
    },
    redis: {
      url: env.REDIS_URL,
    },
    storage: {
      accessKey: env.MINIO_ACCESS_KEY,
      bucket: env.MINIO_BUCKET,
      endpoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      secretKey: env.MINIO_SECRET_KEY,
      useSsl: env.MINIO_USE_SSL,
    },
  };
};
